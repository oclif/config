import * as fs from 'fs-extra'
import * as readJSON from 'load-json-file'
import * as _ from 'lodash'
import * as os from 'os'
import * as path from 'path'
import * as readPkg from 'read-pkg'
import {inspect} from 'util'

import {IEngine} from './engine'
import {IPJSON} from './pjson'

const _pjson = require('../package.json')
const _base = `${_pjson.name}@${_pjson.version}`

export type PlatformTypes = 'darwin' | 'linux' | 'win32' | 'aix' | 'freebsd' | 'openbsd' | 'sunos'
export type ArchTypes = 'arm' | 'arm64' | 'mips' | 'mipsel' | 'ppc' | 'ppc64' | 's390' | 's390x' | 'x32' | 'x64' | 'x86'

export interface IConfig {
  /**
   * @dxcli/config version
   */
  _base: string
  /**
   * base path of root plugin
   */
  root: string
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
   * full path to command dir of plugin
   */
  commandsDir: string | undefined
  /**
   * full path to command dir of plugin's typescript files for development
   */
  commandsDirTS?: string
  /**
   * normalized full paths to hooks
   */
  hooks: {[k: string]: string[]}
  /**
   * normalized full paths to typescript hooks
   */
  hooksTS?: {[k: string]: string[]}
  /**
   * if plugins points to a module this is the full path to that module
   *
   * for dynamic plugin loading
   */
  pluginsModule: string | undefined
  /**
   * if plugins points to a module this is the full path to that module's typescript
   */
  pluginsModuleTS: string | undefined
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
   * CLI name from package.json
   */
  name: string
  /**
   * full package.json
   *
   * parsed with read-pkg
   */
  pjson: IPJSON
  /**
   * process.platform
   */
  platform: PlatformTypes
  /**
   * active shell
   */
  shell: string
  /**
   * parsed tsconfig.json
   */
  tsconfig: TSConfig | undefined
  /**
   * user agent to use for http calls
   *
   * example: mycli/1.2.3 (darwin-x64) node-9.0.0
   */
  userAgent: string
  /**
   * cli version from package.json
   *
   * example: 1.2.3
   */
  version: string
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
   * active @dxcli/engine
   */
  engine?: IEngine
  /**
   * npm registry to use for installing plugins
   */
  npmRegistry: string
}

export interface ICLIConfig extends IConfig {
  engine: IEngine
}

export interface TSConfig {
  compilerOptions: {
    rootDirs?: string[]
    outDir?: string
  }
}

export interface ConfigOptions {
  name?: string
  root?: string
  baseConfig?: IConfig
}

const debug = require('debug')('@dxcli/config')

export class Config implements IConfig {
  /**
   * registers ts-node for reading typescript source (./src) instead of compiled js files (./lib)
   * there are likely issues doing this any the tsconfig.json files are not compatible with others
   */
  readonly _base = _base
  arch: ArchTypes
  bin: string
  cacheDir: string
  configDir: string
  dataDir: string
  dirname: string
  errlog: string
  home: string
  name: string
  pjson: any
  platform: PlatformTypes
  root: string
  shell: string
  version: string
  windows: boolean
  userAgent: string
  commandsDir: string | undefined
  commandsDirTS: string | undefined
  pluginsModule: string | undefined
  pluginsModuleTS: string | undefined
  tsconfig: TSConfig | undefined
  debug: number = 0
  hooks: {[k: string]: string[]}
  hooksTS?: {[k: string]: string[]}
  engine?: IEngine
  npmRegistry: string

  constructor() {
    this.arch = (os.arch() === 'ia32' ? 'x86' : os.arch() as any)
    this.platform = os.platform() as any
    this.windows = this.platform === 'win32'
  }

  async load(root: string, pjson: readPkg.Package, baseConfig?: IConfig) {
    const base: IConfig = baseConfig || {} as any
    this.root = root
    this.pjson = pjson

    this.name = this.pjson.name
    this.version = this.pjson.version
    if (!this.pjson.dxcli) this.pjson.dxcli = this.pjson.dxcli || this.pjson['cli-engine'] || {}
    this.bin = this.pjson.dxcli.bin || base.bin || this.name
    this.dirname = this.pjson.dxcli.dirname || base.dirname || this.name
    this.userAgent = `${this.name}/${this.version} (${this.platform}-${this.arch}) node-${process.version}`
    this.shell = this._shell()
    this.debug = this._debug()

    this.home = process.env.HOME || (this.windows && this.windowsHome()) || os.homedir() || os.tmpdir()
    this.cacheDir = this.scopedEnvVar('CACHE_DIR') || this.macosCacheDir() || this.dir('cache')
    this.configDir = this.scopedEnvVar('CONFIG_DIR') || this.dir('config')
    this.dataDir = this.scopedEnvVar('DATA_DIR') || this.dir('data')
    this.errlog = path.join(this.cacheDir, 'error.log')

    this.tsconfig = await this._tsConfig()
    if (this.pjson.dxcli.commands) {
      this.commandsDir = path.join(this.root, this.pjson.dxcli.commands)
      this.commandsDirTS = await this._tsPath(this.pjson.dxcli.commands)
    }
    this.hooks = _.mapValues(this.pjson.dxcli.hooks || {}, h => _.castArray(h).map(h => path.join(this.root, h)))
    this.hooksTS = await this._hooks()
    if (typeof this.pjson.dxcli.plugins === 'string') {
      this.pluginsModule = path.join(this.root, this.pjson.dxcli.plugins)
      this.pluginsModuleTS = await this._tsPath(this.pjson.dxcli.plugins)
    }
    this.npmRegistry = this.scopedEnvVar('NPM_REGISTRY') || this.pjson.dxcli.npmRegistry || 'https://registry.yarnpkg.com'

    return this
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

  private dir(category: 'cache' | 'data' | 'config'): string {
    const base = process.env[`XDG_${category.toUpperCase()}_HOME`]
      || (this.windows && process.env.LOCALAPPDATA)
      || path.join(this.home, category === 'data' ? '.local/share' : '.' + category)
    return path.join(base, this.dirname)
  }

  private windowsHome() { return this.windowsHomedriveHome() || this.windowsUserprofileHome() }
  private windowsHomedriveHome() { return (process.env.HOMEDRIVE && process.env.HOMEPATH && path.join(process.env.HOMEDRIVE!, process.env.HOMEPATH!)) }
  private windowsUserprofileHome() { return process.env.USERPROFILE }
  private macosCacheDir(): string | undefined { return this.platform === 'darwin' && path.join(this.home, 'Library', 'Caches', this.dirname) || undefined }

  private async _tsConfig(): Promise<TSConfig | undefined> {
    try {
      const tsconfigPath = path.join(this.root, 'tsconfig.json')
      const tsconfig = await readJSON(tsconfigPath)
      if (!tsconfig || !tsconfig.compilerOptions) return
      return tsconfig
    } catch (err) {
      if (err.code !== 'ENOENT') throw err
    }
  }

  /**
   * convert a path from the compiled ./lib files to the ./src typescript source
   * this is for developing typescript plugins/CLIs
   * if there is a tsconfig and the original sources exist, it attempts to require ts-
   */
  private async _tsPath(orig: string): Promise<string | undefined> {
    if (!orig) return
    orig = path.join(this.root, orig)
    if (!this.tsconfig) return
    let {rootDirs, outDir} = this.tsconfig.compilerOptions
    if (!rootDirs || !rootDirs.length || !outDir) return
    let rootDir = rootDirs[0]
    try {
      // rewrite path from ./lib/foo to ./src/foo
      const lib = path.join(this.root, outDir) // ./lib
      const src = path.join(this.root, rootDir) // ./src
      const relative = path.relative(lib, orig) // ./commands
      const out = path.join(src, relative) // ./src/commands
      // this can be a directory of commands or point to a hook file
      // if it's a directory, we check if the path exists. If so, return the path to the directory.
      // For hooks, it might point to a module, not a file. Something like "./hooks/myhook"
      // That file doesn't exist, and the real file is "./hooks/myhook.ts"
      // In that case we attempt to resolve to the filename. If it fails it will revert back to the lib path
      if (!await fs.pathExists(out)) return require.resolve(out)
      return out
    } catch (err) {
      debug(err)
      return
    }
  }

  private async _hooks(): Promise<{[k: string]: string[]} | undefined> {
    const hooks: {[k: string]: string[]} = {}
    if (_.isEmpty(this.pjson.dxcli.hooks)) return
    for (let [k, h] of Object.entries(this.pjson.dxcli.hooks)) {
      hooks[k] = []
      for (let m of _.castArray(h)) {
        const ts = await this._tsPath(m)
        if (!ts) return
        hooks[k].push(ts)
      }
    }
    return hooks
  }

  private _shell(): string {
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

  private _debug(): number {
    try {
      const {enabled} = require('debug')(this.bin)
      if (enabled) return 1
      if (this.scopedEnvVarTrue('DEBUG')) return 1
      return 0
    // tslint:disable-next-line
    } catch (err) { return 0 }
  }
}

/**
 * find package root
 * for packages installed into node_modules this will go up directories until
 * it finds a node_modules directory with the plugin installed into it
 *
 * This is needed because of the deduping npm does
 */
async function findPkg(name: string | undefined, root: string) {
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
    if (await fs.pathExists(cur)) return cur
  }
}

/**
 * returns true if config is instantiated and not ConfigOptions
 */
export function isIConfig(o: any): o is IConfig {
  return !!o._base
}

/**
 * reads a plugin/CLI's config
 */
export async function read(opts: ConfigOptions = {}): Promise<IConfig> {
  let root = opts.root || (module.parent && module.parent.parent && module.parent.parent.filename) || __dirname
  const pkgPath = await findPkg(opts.name, root)
  if (!pkgPath) throw new Error(`could not find package.json with ${inspect(opts)}`)
  debug('reading plugin %s', path.dirname(pkgPath))
  const pkg = await readPkg(pkgPath)
  const config = new Config()
  await config.load(path.dirname(pkgPath), pkg, opts.baseConfig)
  return config
}
