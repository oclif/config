import {CLIError} from '@anycli/errors'
import * as os from 'os'
import * as path from 'path'

import Debug from './debug'
import {Hooks} from './hooks'
import {PJSON} from './pjson'
import * as Plugin from './plugin'
import {loadJSONSync} from './util'

export type PlatformTypes = 'darwin' | 'linux' | 'win32' | 'aix' | 'freebsd' | 'openbsd' | 'sunos'
export type ArchTypes = 'arm' | 'arm64' | 'mips' | 'mipsel' | 'ppc' | 'ppc64' | 's390' | 's390x' | 'x32' | 'x64' | 'x86'
export interface Options extends Plugin.Options {
  devPlugins?: boolean
  userPlugins?: boolean
}

const debug = Debug()

export interface IConfig extends Plugin.IPlugin {
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

  runCommand(id: string, argv?: string[]): Promise<void>
}

export class Config extends Plugin.Plugin implements IConfig {
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

  constructor(opts: Options) {
    super(opts)
    if (this.alreadyLoaded) return

    this.arch = (os.arch() === 'ia32' ? 'x86' : os.arch() as any)
    this.platform = os.platform() as any
    this.windows = this.platform === 'win32'
    this.bin = this.pjson.anycli.bin || this.name
    this.dirname = this.pjson.anycli.dirname || this.name
    this.userAgent = `${this.name}/${this.version} (${this.platform}-${this.arch}) node-${process.version}`
    this.shell = this._shell()
    this.debug = this._debug()

    this.home = process.env.HOME || (this.windows && this.windowsHome()) || os.homedir() || os.tmpdir()
    this.cacheDir = this.scopedEnvVar('CACHE_DIR') || this.macosCacheDir() || this.dir('cache')
    this.configDir = this.scopedEnvVar('CONFIG_DIR') || this.dir('config')
    this.dataDir = this.scopedEnvVar('DATA_DIR') || this.dir('data')
    this.errlog = path.join(this.cacheDir, 'error.log')

    this.npmRegistry = this.scopedEnvVar('NPM_REGISTRY') || this.pjson.anycli.npmRegistry || 'https://registry.yarnpkg.com'

    if (opts.devPlugins !== false) {
      try {
        const devPlugins = this.pjson.anycli.devPlugins
        if (devPlugins) this.loadPlugins(this.root, devPlugins)
      } catch (err) {
        process.emitWarning(err)
      }
    }

    if (opts.userPlugins !== false) {
      try {
        const userPJSONPath = path.join(this.dataDir, 'package.json')
        const pjson = this.userPJSON = loadJSONSync(userPJSONPath)
        if (!pjson.anycli) pjson.anycli = {schema: 1}
        this.loadPlugins(userPJSONPath, pjson.anycli.plugins)
      } catch (err) {
        if (err.code !== 'ENOENT') process.emitWarning(err)
      }
    }

    debug('config done')
  }

  async runHook<T extends Hooks, K extends keyof T>(event: K, opts: T[K]) {
    debug('start %s hook', event)
    await super.runHook<T, K>(event, {...opts as any || {}, config: this})
    debug('done %s hook', event)
  }

  async runCommand(id: string, argv: string[] = []) {
    debug('runCommand %s %o', id, argv)
    const c = this.findCommand(id)
    if (!c) throw new CLIError(`command ${id} not found`)
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
      .map(p => p.replace(/-/g, '_'))
      .join('_')
      .toUpperCase()
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
}
export type LoadOptions = Options | string | IConfig | undefined
export function load(opts: LoadOptions = (module.parent && module.parent && module.parent.parent && module.parent.parent.filename) || __dirname) {
  if (typeof opts === 'string') opts = {root: opts}
  if (isConfig(opts)) return opts
  return new Config(opts)
}

function isConfig(o: any): o is IConfig {
  return o && !!o._base
}
