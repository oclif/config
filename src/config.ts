import {CLIError, error, exit, warn} from '@oclif/errors'
import * as os from 'os'
import * as path from 'path'
import {inspect} from 'util'

import {Command} from './command'
import Debug from './debug'
import {Hook, Hooks} from './hooks'
import {PJSON} from './pjson'
import * as Plugin from './plugin'
import {Topic} from './topic'
import {tsPath} from './ts_node'
import {compact, flatMap, loadJSON, uniq} from './util'

export type PlatformTypes = 'darwin' | 'linux' | 'win32' | 'aix' | 'freebsd' | 'openbsd' | 'sunos'
export type ArchTypes = 'arm' | 'arm64' | 'mips' | 'mipsel' | 'ppc' | 'ppc64' | 's390' | 's390x' | 'x32' | 'x64' | 'x86'
export interface Options extends Plugin.Options {
  devPlugins?: boolean
  userPlugins?: boolean
}

const debug = Debug()

export interface IConfig {
  name: string
  version: string
  channel?: string
  pjson: PJSON.CLI
  /**
   * process.arch
   */
  arch: ArchTypes
  /**
   * bin name of CLI command
   */
  bin: string
  /**
   * cache directory to use for CLI
   *
   * example ~/Library/Caches/mycli or ~/.cache/mycli
   */
  cacheDir: string
  /**
   * config directory to use for CLI
   *
   * example: ~/.config/mycli
   */
  configDir: string
  /**
   * data directory to use for CLI
   *
   * example: ~/.local/share/mycli
   */
  dataDir: string
  /**
   * base dirname to use in cacheDir/configDir/dataDir
   */
  dirname: string
  /**
   * points to a file that should be appended to for error logs
   *
   * example: ~/Library/Caches/mycli/error.log
   */
  errlog: string
  /**
   * path to home directory
   *
   * example: /home/myuser
   */
  home: string
  /**
   * process.platform
   */
  platform: PlatformTypes
  /**
   * active shell
   */
  shell: string
  /**
   * user agent to use for http calls
   *
   * example: mycli/1.2.3 (darwin-x64) node-9.0.0
   */
  userAgent: string
  /**
   * if windows
   */
  windows: boolean
  /**
   * debugging level
   *
   * set by ${BIN}_DEBUG or DEBUG=$BIN
   */
  debug: number
  /**
   * npm registry to use for installing plugins
   */
  npmRegistry: string
  userPJSON?: PJSON.User
  plugins: Plugin.IPlugin[]
  readonly commands: Command.Plugin[]
  readonly topics: Topic[]
  readonly commandIDs: string[]

  runCommand(id: string, argv?: string[]): Promise<void>
  runHook<T extends Hooks, K extends keyof T>(event: K, opts: T[K]): Promise<void>
  findCommand(id: string, opts: {must: true}): Command.Plugin
  findCommand(id: string, opts?: {must: boolean}): Command.Plugin | undefined
  findTopic(id: string, opts: {must: true}): Topic
  findTopic(id: string, opts?: {must: boolean}): Topic | undefined
  scopedEnvVar(key: string): string | undefined
  scopedEnvVarKey(key: string): string
  scopedEnvVarTrue(key: string): boolean
}

const _pjson = require('../package.json')

export class Config implements IConfig {
  _base = `${_pjson.name}@${_pjson.version}`
  name!: string
  version!: string
  channel?: string
  root!: string
  arch!: ArchTypes
  bin!: string
  cacheDir!: string
  configDir!: string
  dataDir!: string
  dirname!: string
  errlog!: string
  home!: string
  platform!: PlatformTypes
  shell!: string
  windows!: boolean
  userAgent!: string
  debug: number = 0
  npmRegistry!: string
  pjson!: PJSON.CLI
  userPJSON?: PJSON.User
  plugins: Plugin.IPlugin[] = []
  protected warned = false

  constructor(public options: Options) {}

  async load() {
    await this.loadPlugins(this.options.root, 'core', [{root: this.options.root}], {must: true})
    const plugin = this.plugins[0]
    this.root = plugin.root
    this.pjson = plugin.pjson
    this.name = this.pjson.name
    this.version = this.pjson.version
    this.channel = this.pjson.channel

    this.arch = (os.arch() === 'ia32' ? 'x86' : os.arch() as any)
    this.platform = os.platform() as any
    this.windows = this.platform === 'win32'
    this.bin = this.pjson.oclif.bin || this.name
    this.dirname = this.pjson.oclif.dirname || this.name
    if (this.platform === 'win32') this.dirname = this.dirname.replace('/', '\\')
    this.userAgent = `${this.name}/${this.version} ${this.platform}-${this.arch} node-${process.version}`
    this.shell = this._shell()
    this.debug = this._debug()

    this.home = process.env.HOME || (this.windows && this.windowsHome()) || os.homedir() || os.tmpdir()
    this.cacheDir = this.scopedEnvVar('CACHE_DIR') || this.macosCacheDir() || this.dir('cache')
    this.configDir = this.scopedEnvVar('CONFIG_DIR') || this.dir('config')
    this.dataDir = this.scopedEnvVar('DATA_DIR') || this.dir('data')
    this.errlog = path.join(this.cacheDir, 'error.log')

    this.npmRegistry = this.scopedEnvVar('NPM_REGISTRY') || this.pjson.oclif.npmRegistry || 'https://registry.yarnpkg.com'

    await Promise.all([
      this.loadCorePlugins(),
      this.loadUserPlugins(),
      this.loadDevPlugins(),
    ])
    debug('config done')
  }

  async loadCorePlugins() {
    if (this.pjson.oclif.plugins) {
      await this.loadPlugins(this.root, 'core', this.pjson.oclif.plugins)
    }
  }

  async loadDevPlugins() {
    if (this.options.devPlugins !== false) {
      try {
        const devPlugins = this.pjson.oclif.devPlugins
        if (devPlugins) await this.loadPlugins(this.root, 'dev', devPlugins)
      } catch (err) {
        process.emitWarning(err)
      }
    }
  }

  async loadUserPlugins() {
    if (this.options.userPlugins !== false) {
      try {
        const userPJSONPath = path.join(this.dataDir, 'package.json')
        const pjson = this.userPJSON = await loadJSON(userPJSONPath)
        if (!pjson.oclif) pjson.oclif = {schema: 1}
        await this.loadPlugins(userPJSONPath, 'user', pjson.oclif.plugins)
      } catch (err) {
        if (err.code !== 'ENOENT') process.emitWarning(err)
      }
    }
  }

  async runHook<T extends Hooks, K extends keyof T>(event: K, opts: T[K]) {
    debug('start %s hook', event)
    const context: Hook.Context = {
      config: this,
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
    const promises = this.plugins.map(p => {
      return Promise.all((p.hooks[event] || [])
      .map(async hook => {
        try {
          const f = tsPath(p.root, hook)
          debug('hook', event, f)
          const search = (m: any): Hook<K> => {
            if (typeof m === 'function') return m
            if (m.default && typeof m.default === 'function') return m.default
            return Object.values(m).find((m: any) => typeof m === 'function') as Hook<K>
          }

          await search(require(f)).call(context, {...opts as any, config: this})
        } catch (err) {
          if (err && err.oclif && err.oclif.exit !== undefined) throw err
          this.warn(err, `runHook ${event}`)
        }
      }))
    })
    await Promise.all(promises)
    debug('%s hook done', event)
  }

  async runCommand(id: string, argv: string[] = []) {
    debug('runCommand %s %o', id, argv)
    const c = this.findCommand(id)
    if (!c) {
      await this.runHook('command_not_found', {id})
      throw new CLIError(`command ${id} not found`)
    }
    const command = c.load()
    await this.runHook('prerun', {Command: command, argv})
    await command.run(argv, this)
  }

  scopedEnvVar(k: string) {
    return process.env[this.scopedEnvVarKey(k)]
  }

  scopedEnvVarTrue(k: string): boolean {
    let v = process.env[this.scopedEnvVarKey(k)]
    return v === '1' || v === 'true'
  }

  scopedEnvVarKey(k: string) {
    return [this.bin, k]
      .map(p => p.replace(/@/g, '').replace(/[-\/]/g, '_'))
      .join('_')
      .toUpperCase()
  }

  findCommand(id: string, opts: {must: true}): Command.Plugin
  findCommand(id: string, opts?: {must: boolean}): Command.Plugin | undefined
  findCommand(id: string, opts: {must?: boolean} = {}): Command.Plugin | undefined {
    let command = this.commands.find(c => c.id === id || c.aliases.includes(id))
    if (command) return command
    if (opts.must) error(`command ${id} not found`)
  }

  findTopic(id: string, opts: {must: true}): Topic
  findTopic(id: string, opts?: {must: boolean}): Topic | undefined
  findTopic(name: string, opts: {must?: boolean} = {}) {
    let topic = this.topics.find(t => t.name === name)
    if (topic) return topic
    if (opts.must) throw new Error(`topic ${name} not found`)
  }

  get commands(): Command.Plugin[] { return flatMap(this.plugins, p => p.commands) }
  get commandIDs() { return uniq(this.commands.map(c => c.id)) }
  get topics(): Topic[] {
    let topics: Topic[] = []
    for (let plugin of this.plugins) {
      for (let topic of compact(plugin.topics)) {
        let existing = topics.find(t => t.name === topic.name)
        if (existing) {
          existing.description = topic.description || existing.description
          existing.hidden = existing.hidden || topic.hidden
        } else topics.push(topic)
      }
    }
    // add missing topics
    for (let c of this.commands.filter(c => !c.hidden)) {
      let parts = c.id.split(':')
      while (parts.length) {
        let name = parts.join(':')
        if (name && !topics.find(t => t.name === name)) {
          topics.push({name, description: c.description})
        }
        parts.pop()
      }
    }
    return topics
  }

  protected dir(category: 'cache' | 'data' | 'config'): string {
    const base = process.env[`XDG_${category.toUpperCase()}_HOME`]
      || (this.windows && process.env.LOCALAPPDATA)
      || path.join(this.home, category === 'data' ? '.local/share' : '.' + category)
    return path.join(base, this.dirname)
  }

  protected windowsHome() { return this.windowsHomedriveHome() || this.windowsUserprofileHome() }
  protected windowsHomedriveHome() { return (process.env.HOMEDRIVE && process.env.HOMEPATH && path.join(process.env.HOMEDRIVE!, process.env.HOMEPATH!)) }
  protected windowsUserprofileHome() { return process.env.USERPROFILE }
  protected macosCacheDir(): string | undefined { return this.platform === 'darwin' && path.join(this.home, 'Library', 'Caches', this.dirname) || undefined }

  protected _shell(): string {
    let shellPath
    const {SHELL, COMSPEC} = process.env
    if (SHELL) {
      shellPath = SHELL.split('/')
    } else if (this.windows && COMSPEC) {
      shellPath = COMSPEC.split(/\\|\//)
    } else {
      shellPath = ['unknown']
    }
    return shellPath[shellPath.length - 1]
  }

  protected _debug(): number {
    if (this.scopedEnvVarTrue('DEBUG')) return 1
    try {
      const {enabled} = require('debug')(this.bin)
      if (enabled) return 1
    } catch {}
    return 0
  }
  protected async loadPlugins(root: string, type: string, plugins: (string | {root?: string, name?: string, tag?: string})[], options: {must?: boolean} = {}) {
    if (!plugins.length) return
    if (!plugins || !plugins.length) return
    debug('loading plugins', plugins)
    await Promise.all((plugins || []).map(async plugin => {
      try {
        let opts: Options = {type, root}
        if (typeof plugin === 'string') {
          opts.name = plugin
        } else {
          opts.name = plugin.name || opts.name
          opts.tag = plugin.tag || opts.tag
          opts.root = plugin.root || opts.root
        }
        let instance = new Plugin.Plugin(opts)
        await instance.load()
        this.plugins.push(instance)
      } catch (err) {
        if (options.must) throw err
        this.warn(err, 'loadPlugins')
      }
    }))
  }

  protected warn(err: any, scope?: string) {
    if (this.warned) return
    err.name = `${err.name} Plugin: ${this.name}`
    err.detail = compact([err.detail, `module: ${this._base}`, scope && `task: ${scope}`, `plugin: ${this.name}`, `root: ${this.root}`]).join('\n')
    process.emitWarning(err)
  }
}
export type LoadOptions = Options | string | IConfig | undefined
export async function load(opts: LoadOptions = (module.parent && module.parent && module.parent.parent && module.parent.parent.filename) || __dirname) {
  if (typeof opts === 'string') opts = {root: opts}
  if (isConfig(opts)) return opts
  let config = new Config(opts)
  await config.load()
  return config
}

function isConfig(o: any): o is IConfig {
  return o && !!o._base
}
