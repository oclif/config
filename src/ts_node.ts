import * as fs from 'fs-extra'
import * as loadJSON from 'load-json-file'
import * as path from 'path'
import * as TSNode from 'ts-node'

const tsconfigs: {[root: string]: TSConfig} = {}
const rootDirs: string[] = []
const typeRoots = [`${__dirname}/../node_modules/@types`]

const debug = require('debug')('@anycli/config')

export interface TSConfig {
  compilerOptions: {
    rootDirs?: string[]
    outDir?: string
    target?: string
  }
}

function registerTSNode(root: string) {
  if (tsconfigs[root]) return
  const tsconfig = loadTSConfig(root)
  if (!tsconfig) return
  tsconfigs[root] = tsconfig
  debug('registering ts-node at', root)
  const tsNode: typeof TSNode = require('ts-node')
  typeRoots.push(`${root}/../node_modules/@types`)
  if (tsconfig.compilerOptions.rootDirs) {
    rootDirs.push(...tsconfig.compilerOptions.rootDirs.map(r => path.join(root, r)))
  } else {
    rootDirs.push(`${root}/src`)
  }
  tsNode.register({
    project: false,
    // cache: false,
    // typeCheck: true,
    compilerOptions: {
      target: tsconfig.compilerOptions.target || 'es2017',
      module: 'commonjs',
      rootDirs,
      typeRoots,
    }
  })
}

function loadTSConfig(root: string): TSConfig | undefined {
  try {
    // // ignore if no .git as it's likely not in dev mode
    // if (!await fs.pathExists(path.join(this.root, '.git'))) return

    const tsconfigPath = path.join(root, 'tsconfig.json')
    const tsconfig = loadJSON.sync(tsconfigPath)
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
export function tsPath(root: string, orig: string): string
export function tsPath(root: string, orig: string | undefined): string | undefined
export function tsPath(root: string, orig: string | undefined): string | undefined {
  if (!orig) return orig
  orig = path.join(root, orig)
  try {
    registerTSNode(root)
    const tsconfig = tsconfigs[root]
    if (!tsconfig) return orig
    const {rootDirs, outDir} = tsconfig.compilerOptions
    const rootDir = (rootDirs || [])[0]
    if (!rootDir || !outDir) return orig
    // rewrite path from ./lib/foo to ./src/foo
    const lib = path.join(root, outDir) // ./lib
    const src = path.join(root, rootDir) // ./src
    const relative = path.relative(lib, orig) // ./commands
    const out = path.join(src, relative) // ./src/commands
    // this can be a directory of commands or point to a hook file
    // if it's a directory, we check if the path exists. If so, return the path to the directory.
    // For hooks, it might point to a module, not a file. Something like "./hooks/myhook"
    // That file doesn't exist, and the real file is "./hooks/myhook.ts"
    // In that case we attempt to resolve to the filename. If it fails it will revert back to the lib path
    if (fs.pathExistsSync(out) || fs.pathExistsSync(out + '.ts')) return out
    else return orig
  } catch (err) {
    debug(err)
    return orig
  }
}