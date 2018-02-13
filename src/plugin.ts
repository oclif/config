import {error} from '@oclif/errors'
import * as Globby from 'globby'
import * as path from 'path'
import {inspect} from 'util'

import {Command} from './command'
import Debug from './debug'
import {Manifest} from './manifest'
import {PJSON} from './pjson'
import {Topic} from './topic'
import {tsPath} from './ts_node'
import {compact, exists, flatMap, loadJSON, mapValues} from './util'

export interface Options {
  root: string
  name?: string
  type?: string
  tag?: string
  ignoreManifest?: boolean
}

export interface IPlugin {
  /**
   * @oclif/config version
   */
  _base: string
  /**
   * name from package.json
   */
  name: string
  /**
   * version from package.json
   *
   * example: 1.2.3
   */
  version: string
  /**
   * full package.json
   *
   * parsed with read-pkg
   */
  pjson: PJSON.Plugin | PJSON.CLI
  /**
   * used to tell the user how the plugin was installed
   * examples: core, link, user, dev
   */
  type: string
  /**
   * base path of plugin
   */
  root: string
  /**
   * npm dist-tag of plugin
   * only used for user plugins
   */
  tag?: string
  /**
   * if it appears to be an npm package but does not look like it's really a CLI plugin, this is set to false
   */
  valid: boolean

  commands: Command.Plugin[]
  hooks: {[k: string]: string[]}
  readonly commandIDs: string[]
  readonly topics: Topic[]

  findCommand(id: string, opts: {must: true}): Command.Class
  findCommand(id: string, opts?: {must: boolean}): Command.Class | undefined
  load(): Promise<void>
}

const debug = Debug()
const _pjson = require('../package.json')

export class Plugin implements IPlugin {
  // static loadedPlugins: {[name: string]: Plugin} = {}
  _base = `${_pjson.name}@${_pjson.version}`
  name!: string
  version!: string
  pjson!: PJSON.Plugin
  type!: string
  root!: string
  tag?: string
  manifest!: Manifest
  commands!: Command.Plugin[]
  hooks!: {[k: string]: string[]}
  valid = false
  alreadyLoaded = false
  protected warned = false

  constructor(public options: Options) {}

  async load() {
    this.type = this.options.type || 'core'
    this.tag = this.options.tag
    const root = await findRoot(this.options.name, this.options.root)
    if (!root) throw new Error(`could not find package.json with ${inspect(this.options)}`)
    this.root = root
    debug('reading %s plugin %s', this.type, root)
    this.pjson = await loadJSON(path.join(root, 'package.json')) as any
    this.name = this.pjson.name
    this.version = this.pjson.version
    if (this.pjson.oclif) {
      this.valid = true
    } else {
      this.pjson.oclif = this.pjson['cli-engine'] || {}
    }

    this.hooks = mapValues(this.pjson.oclif.hooks || {}, i => Array.isArray(i) ? i : [i])

    this.manifest = await this._manifest(!!this.options.ignoreManifest)
    this.commands = Object.entries(this.manifest.commands)
    .map(([id, c]) => ({...c, load: () => this.findCommand(id, {must: true})}))
  }

  get topics(): Topic[] { return topicsToArray(this.pjson.oclif.topics || {}) }

  get commandsDir() { return tsPath(this.root, this.pjson.oclif.commands) }
  get commandIDs() {
    if (!this.commandsDir) return []
    let globby: typeof Globby
    try {
      globby = require('globby')
    } catch {
      debug('not loading plugins, globby not found')
      return []
    }
    debug(`loading IDs from ${this.commandsDir}`)
    const ids = globby.sync(['**/*.+(js|ts)', '!**/*.+(d.ts|test.ts|test.js)'], {cwd: this.commandsDir})
    .map(file => {
      const p = path.parse(file)
      const topics = p.dir.split('/')
      let command = p.name !== 'index' && p.name
      return [...topics, command].filter(f => f).join(':')
    })
    debug('found ids', ids)
    return ids
  }

  findCommand(id: string, opts: {must: true}): Command.Class
  findCommand(id: string, opts?: {must: boolean}): Command.Class | undefined
  findCommand(id: string, opts: {must?: boolean} = {}): Command.Class | undefined {
    const fetch = () => {
      if (!this.commandsDir) return
      const search = (cmd: any) => {
        if (typeof cmd.run === 'function') return cmd
        if (cmd.default && cmd.default.run) return cmd.default
        return Object.values(cmd).find((cmd: any) => typeof cmd.run === 'function')
      }
      const p = require.resolve(path.join(this.commandsDir, ...id.split(':')))
      debug('require', p)
      let m
      try {
        m = require(p)
      } catch (err) {
        if (!opts.must && err.code === 'MODULE_NOT_FOUND') return
        throw err
      }
      const cmd = search(m)
      if (!cmd) return
      cmd.id = id
      cmd.plugin = this
      return cmd
    }
    const cmd = fetch()
    if (!cmd && opts.must) error(`command ${id} not found`)
    return cmd
  }

  protected async _manifest(ignoreManifest: boolean): Promise<Manifest> {
    const readManifest = async () => {
      try {
        const p = path.join(this.root, '.oclif.manifest.json')
        const manifest: Manifest = await loadJSON(p)
        if (!process.env.ANYCLI_NEXT_VERSION && manifest.version !== this.version) {
          process.emitWarning(`Mismatched version in ${this.name} plugin manifest. Expected: ${this.version} Received: ${manifest.version}`)
        } else {
          debug('using manifest from', p)
          return manifest
        }
      } catch (err) {
        if (err.code !== 'ENOENT') this.warn(err, 'readManifest')
      }
    }
    if (!ignoreManifest) {
      let manifest = await readManifest()
      if (manifest) return manifest
    }

    return {
      version: this.version,
      commands: this.commandIDs.map(id => {
        try {
          return [id, Command.toCached(this.findCommand(id, {must: true}), this)]
        } catch (err) { this.warn(err, 'toCached') }
      })
      .filter((f): f is [string, Command] => !!f)
      .reduce((commands, [id, c]) => {
        commands[id] = c
        return commands
      }, {} as {[k: string]: Command})
    }
  }

  protected warn(err: any, scope?: string) {
    if (this.warned) return
    err.name = `${err.name} Plugin: ${this.name}`
    err.detail = compact([err.detail, `module: ${this._base}`, scope && `task: ${scope}`, `plugin: ${this.name}`, `root: ${this.root}`]).join('\n')
    process.emitWarning(err)
  }
}

function topicsToArray(input: any, base?: string): Topic[] {
  if (!input) return []
  base = base ? `${base}:` : ''
  if (Array.isArray(input)) {
    return input.concat(flatMap(input, t => topicsToArray(t.subtopics, `${base}${t.name}`)))
  }
  return flatMap(Object.keys(input), k => {
    return [{...input[k], name: `${base}${k}`}].concat(topicsToArray(input[k].subtopics, `${base}${input[k].name}`))
  })
}

/**
 * find package root
 * for packages installed into node_modules this will go up directories until
 * it finds a node_modules directory with the plugin installed into it
 *
 * This is needed because of the deduping npm does
 */
async function findRoot(name: string | undefined, root: string) {
  // essentially just "cd .."
  function* up(from: string) {
    while (path.dirname(from) !== from) {
      yield from
      from = path.dirname(from)
    }
    yield from
  }
  for (let next of up(root)) {
    let cur
    if (name) {
      cur = path.join(next, 'node_modules', name, 'package.json')
      if (await exists(cur)) return path.dirname(cur)
      try {
        let pkg = await loadJSON(path.join(next, 'package.json'))
        if (pkg.name === name) return next
      } catch {}
    } else {
      cur = path.join(next, 'package.json')
      if (await exists(cur)) return path.dirname(cur)
    }
  }
}
