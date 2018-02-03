import cli from 'cli-ux'
import * as fs from 'fs-extra'
import * as loadJSON from 'load-json-file'
import * as _ from 'lodash'
import * as path from 'path'
import * as readPkg from 'read-pkg'
import {inspect} from 'util'

import * as Config from '.'
import {tsPath} from './ts_node'
import {undefault} from './util'

export interface Options {
  root: string
  name?: string
  type?: string
  tag?: string
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
  pjson: Config.PJSON
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

  allCommands(): Config.Command.Plugin[]
  allTopics(): Config.Topic[]
  findCommand(id: string, opts: {must: true}): Config.Command.Plugin
  findCommand(id: string, opts?: {must: boolean}): Config.Command.Plugin | undefined
  findTopic(id: string, opts: {must: true}): Config.Topic
  findTopic(id: string, opts?: {must: boolean}): Config.Topic | undefined
  runHook<T extends {}>(event: string, opts?: T): Promise<void>
}

const debug = require('debug')('@anycli/config')
const _pjson = require('../package.json')

const loadedPlugins: {[name: string]: Plugin} = {}

export class Plugin implements IPlugin {
  _base = `${_pjson.name}@${_pjson.version}`
  name!: string
  version!: string
  pjson!: Config.PJSON
  type: string
  root!: string
  tag?: string
  manifest!: Config.Manifest
  topics!: Config.Topic[]
  plugins: IPlugin[] = []
  hooks!: {[k: string]: string[]}
  valid!: boolean

  constructor(opts: Options) {
    this.type = opts.type || 'core'
    const root = findRoot(opts.name, opts.root)
    if (!root) throw new Error(`could not find package.json with ${inspect(opts)}`)
    if (loadedPlugins[root]) return loadedPlugins[root]
    loadedPlugins[root] = this
    this.root = root
    debug('reading plugin %s', root)
    this.pjson = readPkg.sync(path.join(root, 'package.json')) as any
    this.name = this.pjson.name
    this.version = this.pjson.version
    if (!this.pjson.anycli) {
      this.pjson.anycli = this.pjson['cli-engine'] || {}
    }
    this.valid = this.pjson.anycli.schema === 1

    this.topics = topicsToArray(this.pjson.anycli.topics || {})
    this.hooks = _.mapValues(this.pjson.anycli.hooks || {}, _.castArray)

    this.manifest = this._manifest()
    this.loadPlugins()
  }

  get commandsDir() {
    return tsPath(this.root, this.pjson.anycli.commands)
  }

  allTopics() {
    let topics = [...this.topics]
    for (let plugin of this.plugins) {
      topics = [...topics, ...plugin.allTopics()]
    }
    return topics
  }

  allCommands() {
    let commands = Object.entries(this.manifest.commands)
    .map(([id, c]) => ({...c, load: () => this._findCommand(id)}))
    for (let plugin of this.plugins) {
      commands = [...commands, ...plugin.allCommands()]
    }
    return commands
  }

  findCommand(id: string, opts: {must: true}): Config.Command.Plugin
  findCommand(id: string, opts?: {must: boolean}): Config.Command.Plugin | undefined
  findCommand(id: string, opts: {must?: boolean} = {}): Config.Command.Plugin | undefined {
    let command = this.manifest.commands[id]
    if (command) return {...command, load: () => this._findCommand(id)}
    for (let plugin of this.plugins) {
      let command = plugin.findCommand(id)
      if (command) return command
    }
    if (opts.must) throw new Error(`command ${id} not found`)
  }

  _findCommand(id: string): Config.Command.Full {
    const search = (cmd: any) => {
      if (_.isFunction(cmd.run)) return cmd
      return Object.values(cmd).find((cmd: any) => _.isFunction(cmd.run))
    }
    const p = require.resolve(path.join(this.commandsDir!, ...id.split(':')))
    debug('require', p)
    const cmd = search(require(p))
    cmd.id = id
    return cmd
  }

  findTopic(id: string, opts: {must: true}): Config.Topic
  findTopic(id: string, opts?: {must: boolean}): Config.Topic | undefined
  findTopic(name: string, opts: {must?: boolean} = {}) {
    let topic = this.topics.find(t => t.name === name)
    if (topic) return topic
    for (let plugin of this.plugins) {
      let topic = plugin.findTopic(name)
      if (topic) return topic
    }
    if (opts.must) throw new Error(`topic ${name} not found`)
  }

  async runHook<T extends {}>(event: string, opts?: T) {
    const promises = (this.hooks[event] || [])
    .map(async hook => {
      try {
        await undefault(require(tsPath(this.root, hook)))(opts)
      } catch (err) {
        if (err.code === 'EEXIT') throw err
        cli.warn(err)
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

  protected _manifest(): Config.Manifest {
    try {
      const p = path.join(this.root, '.anycli.manifest.json')
      const manifest: Config.Manifest = loadJSON.sync(p)
      if (manifest.version !== this.version) {
        cli.warn(`Mismatched version in ${this.name} plugin manifest. Expected: ${this.version} Received: ${manifest.version}`)
      } else {
        debug('using manifest from', p)
        return manifest
      }
    } catch (err) {
      if (err.code !== 'ENOENT') cli.warn(err)
    }
    if (this.commandsDir) return Config.Manifest.build(this.version, this.commandsDir, id => this._findCommand(id))
    return {version: this.version, commands: {}}
  }

  protected loadPlugins(dev = false) {
    const plugins = this.pjson.anycli[dev ? 'devPlugins' : 'plugins']
    if (!plugins || !plugins.length) return
    debug(`loading ${dev ? 'dev ' : ''}plugins`, plugins)
    for (let plugin of plugins || []) {
      try {
        let opts: Options = {type: this.type, root: this.root}
        if (typeof plugin === 'string') opts.name = plugin
        else opts = {...opts, ...plugin}
        this.plugins.push(new Plugin(opts))
      } catch (err) {
        cli.warn(err)
      }
    }
    return plugins
  }
}

function topicsToArray(input: any, base?: string): Config.Topic[] {
  if (!input) return []
  base = base ? `${base}:` : ''
  if (Array.isArray(input)) {
    return input.concat(_.flatMap(input, t => topicsToArray(t.subtopics, `${base}${t.name}`)))
  }
  return _.flatMap(Object.keys(input), k => {
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
    if (fs.pathExistsSync(cur)) return path.dirname(cur)
  }
}
