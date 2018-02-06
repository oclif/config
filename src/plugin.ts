import {error, exit, warn} from '@anycli/errors'
import * as fs from 'fs'
import * as Globby from 'globby'
import * as path from 'path'
import {inspect} from 'util'

import {Command} from './command'
import Debug from './debug'
import {Hook, Hooks} from './hooks'
import {Manifest} from './manifest'
import {PJSON} from './pjson'
import {Topic} from './topic'
import {tsPath} from './ts_node'
import {compact, flatMap, loadJSONSync, mapValues} from './util'

export interface Options {
  root: string
  name?: string
  type?: string
  tag?: string
  ignoreManifest?: boolean
}

export interface IPlugin {
  /**
   * @anycli/config version
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
   * subplugins of this plugin
   */
  plugins: IPlugin[]
  /**
   * if it appears to be an npm package but does not look like it's really a CLI plugin, this is set to false
   */
  valid: boolean

  readonly commands: Command.Plugin[]
  readonly commandIDs: string[]
  readonly topics: Topic[]
  findCommand(id: string, opts: {must: true}): Command.Plugin
  findCommand(id: string, opts?: {must: boolean}): Command.Plugin | undefined
  findTopic(id: string, opts: {must: true}): Topic
  findTopic(id: string, opts?: {must: boolean}): Topic | undefined
  runHook<T extends Hooks, K extends keyof T>(event: K, opts: T[K]): Promise<void>
}

const debug = Debug()
const _pjson = require('../package.json')

export class Plugin implements IPlugin {
  static loadedPlugins: {[name: string]: Plugin} = {}

  _base = `${_pjson.name}@${_pjson.version}`
  name!: string
  version!: string
  pjson!: PJSON.Plugin
  type: string
  root!: string
  tag?: string
  manifest!: Manifest
  _topics!: Topic[]
  plugins: IPlugin[] = []
  hooks!: {[k: string]: string[]}
  valid = false
  alreadyLoaded = false
  protected warned = false

  constructor(opts: Options) {
    this.type = opts.type || 'core'
    this.tag = opts.tag
    const root = findRoot(opts.name, opts.root)
    if (!root) throw new Error(`could not find package.json with ${inspect(opts)}`)
    if (Plugin.loadedPlugins[root]) {
      Plugin.loadedPlugins[root].alreadyLoaded = true
      return Plugin.loadedPlugins[root]
    }
    Plugin.loadedPlugins[root] = this
    this.root = root
    debug('reading plugin %s', root)
    this.pjson = loadJSONSync(path.join(root, 'package.json')) as any
    this.name = this.pjson.name
    this.version = this.pjson.version
    if (this.pjson.anycli) {
      this.valid = true
    } else {
      this.pjson.anycli = this.pjson['cli-engine'] || {}
    }

    this._topics = topicsToArray(this.pjson.anycli.topics || {})
    this.hooks = mapValues(this.pjson.anycli.hooks || {}, i => Array.isArray(i) ? i : [i])

    this.manifest = this._manifest(!!opts.ignoreManifest)
    this.loadPlugins(this.root, this.pjson.anycli.plugins || [])
  }

  get commandsDir() {
    return tsPath(this.root, this.pjson.anycli.commands)
  }

  get topics() {
    let topics = [...this._topics]
    for (let plugin of this.plugins) {
      topics = [...topics, ...plugin.topics]
    }
    return topics
  }

  get commands() {
    let commands = Object.entries(this.manifest.commands)
    .map(([id, c]) => ({...c, load: () => this._findCommand(id, {must: true})}))
    for (let plugin of this.plugins) {
      commands = [...commands, ...plugin.commands]
    }
    return commands
  }

  get commandIDs() {
    let commands = Object.keys(this.manifest.commands)
    for (let plugin of this.plugins) {
      commands = [...commands, ...plugin.commandIDs]
    }
    return commands
  }

  findCommand(id: string, opts: {must: true}): Command.Plugin
  findCommand(id: string, opts?: {must: boolean}): Command.Plugin | undefined
  findCommand(id: string, opts: {must?: boolean} = {}): Command.Plugin | undefined {
    let command = this.manifest.commands[id]
    if (command) return {...command, load: () => this._findCommand(id, {must: true})}
    for (let plugin of this.plugins) {
      let command = plugin.findCommand(id)
      if (command) return command
    }
    if (opts.must) error(`command ${id} not found`)
  }

  findTopic(id: string, opts: {must: true}): Topic
  findTopic(id: string, opts?: {must: boolean}): Topic | undefined
  findTopic(name: string, opts: {must?: boolean} = {}) {
    let topic = this.topics.find(t => t.name === name)
    if (topic) return topic
    for (let plugin of this.plugins) {
      let topic = plugin.findTopic(name)
      if (topic) return topic
    }
    if (opts.must) throw new Error(`topic ${name} not found`)
  }

  async runHook<T extends Hooks, K extends keyof T>(event: K, opts: T[K]) {
    const context: Hook.Context = {
      exit(code = 0) { exit(code) },
      log(message: any = '') {
        message = typeof message === 'string' ? message : inspect(message)
        process.stdout.write(message + '\n')
      },
      error(message, options: {code?: string, exit?: number} = {}) {
        error(message, options)
      },
      warn(message: string) { warn(message) },
    }
    const promises = (this.hooks[event] || [])
    .map(async hook => {
      try {
        const p = tsPath(this.root, hook)
        debug('hook', event, p)
        const search = (m: any): Hook<K> => {
          if (typeof m === 'function') return m
          if (m.default && typeof m.default === 'function') return m.default
          return Object.values(m).find((m: any) => typeof m === 'function') as Hook<K>
        }

        await search(require(p)).call(context, opts)
      } catch (err) {
        if (err && err.anycli && err.anycli.exit !== undefined) throw err
        this.warn(err, `runHook ${event}`)
      }
    })
    promises.push(...this.plugins.map(p => p.runHook(event, opts)))
    await Promise.all(promises)
  }

  protected get _commandIDs(): string[] {
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

  protected _findCommand(id: string, opts: {must: true}): Command.Class
  protected _findCommand(id: string, opts?: {must: boolean}): Command.Class | undefined
  protected _findCommand(id: string, opts: {must?: boolean} = {}): Command.Class | undefined {
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
        if (err.code === 'MODULE_NOT_FOUND') return
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

  protected _manifest(ignoreManifest: boolean): Manifest {
    const readManifest = () => {
      try {
        const p = path.join(this.root, '.anycli.manifest.json')
        const manifest: Manifest = loadJSONSync(p)
        if (manifest.version !== this.version) {
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
      let manifest = readManifest()
      if (manifest) return manifest
    }

    return {
      version: this.version,
      commands: this._commandIDs.map(id => {
        try {
          return [id, Command.toCached(this._findCommand(id, {must: true}))]
        } catch (err) { this.warn(err, 'toCached') }
      })
      .filter((f): f is [string, Command] => !!f)
      .reduce((commands, [id, c]) => {
        commands[id] = c
        return commands
      }, {} as {[k: string]: Command})
    }
  }

  protected loadPlugins(root: string, plugins: (string | PJSON.Plugin)[]) {
    if (!plugins.length) return
    if (!plugins || !plugins.length) return
    debug('loading plugins', plugins)
    for (let plugin of plugins || []) {
      try {
        let opts: Options = {type: this.type, root}
        if (typeof plugin === 'string') {
          opts.name = plugin
        } else {
          opts.name = plugin.name || opts.name
          opts.type = plugin.type || opts.type
          opts.tag = plugin.tag || opts.tag
          opts.root = plugin.root || opts.root
        }
        this.plugins.push(new Plugin(opts))
      } catch (err) { this.warn(err, 'loadPlugins') }
    }
    return plugins
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
function findRoot(name: string | undefined, root: string) {
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
    } else {
      cur = path.join(next, 'package.json')
    }
    if (fs.existsSync(cur)) return path.dirname(cur)
  }
}
