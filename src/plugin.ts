import * as fs from 'fs'
import * as path from 'path'
import {inspect} from 'util'

import {Command} from './command'
import {Hooks} from './hooks'
import {Manifest} from './manifest'
import {PJSON} from './pjson'
import {Topic} from './topic'
import {tsPath} from './ts_node'
import {flatMap, loadJSONSync, mapValues} from './util'

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

const debug = require('debug')('@anycli/config')
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
  valid!: boolean
  ignoreManifest: boolean
  alreadyLoaded = false

  constructor(opts: Options) {
    this.ignoreManifest = !!opts.ignoreManifest
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
    if (!this.pjson.anycli) {
      this.pjson.anycli = this.pjson['cli-engine'] || {}
    }
    this.valid = this.pjson.anycli.schema === 1

    this._topics = topicsToArray(this.pjson.anycli.topics || {})
    this.hooks = mapValues(this.pjson.anycli.hooks || {}, i => Array.isArray(i) ? i : [i])

    this.manifest = this._manifest()
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
    .map(([id, c]) => ({...c, load: () => this._findCommand(id)}))
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
    if (command) return {...command, load: () => this._findCommand(id)}
    for (let plugin of this.plugins) {
      let command = plugin.findCommand(id)
      if (command) return command
    }
    if (opts.must) throw new Error(`command ${id} not found`)
  }

  _findCommand(id: string): Command.Class {
    const search = (cmd: any) => {
      if (typeof cmd.run === 'function') return cmd
      if (cmd.default && cmd.default.run) return cmd.default
      return Object.values(cmd).find((cmd: any) => typeof cmd.run === 'function')
    }
    const p = require.resolve(path.join(this.commandsDir!, ...id.split(':')))
    debug('require', p)
    const cmd = search(require(p))
    cmd.id = id
    cmd.plugin = this
    return cmd
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
    const promises = (this.hooks[event] || [])
    .map(async hook => {
      try {
        const p = tsPath(this.root, hook)
        debug('hook', event, p)
        const search = (m: any) => {
          if (typeof m === 'function') return m
          if (m.default && typeof m.default === 'function') return m.default
          return Object.values(m).find((m: any) => typeof m === 'function')
        }

        await search(require(p))(opts)
      } catch (err) {
        if (err.code === 'EEXIT') throw err
        process.emitWarning(err)
      }
    })
    promises.push(...this.plugins.map(p => p.runHook(event, opts)))
    await Promise.all(promises)
  }

  // findCommand(id: string, opts?: {must: boolean}): ICommand | undefined
  // findManifestCommand(id: string, opts: {must: true}): IManifestCommand
  // findManifestCommand(id: string, opts?: {must: boolean}): IManifestCommand | undefined
  // findTopic(id: string, opts: {must: true}): ITopic
  // findTopic(id: string, opts?: {must: boolean}): ITopic | undefined

  protected _manifest(): Manifest {
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
        if (err.code !== 'ENOENT') process.emitWarning(err)
      }
    }
    if (!this.ignoreManifest) {
      let manifest = readManifest()
      if (manifest) return manifest
    }
    if (this.commandsDir) return Manifest.build(this.version, this.commandsDir, id => this._findCommand(id))
    return {version: this.version, commands: {}}
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
      } catch (err) {
        process.emitWarning(err)
      }
    }
    return plugins
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
