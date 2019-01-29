import * as path from 'path'
import * as tsNode from 'ts-node'

import {TSConfig} from '../src/ts-node'

import {expect, fancy} from './test'

const root = path.resolve(__dirname, 'fixtures/typescript')
const orig = 'src/hooks/init.ts'
let tsNodeRegisterCallArguments: any[] = []

/**
 * Delete a module from the require cache before requiring it.
 */
export default function freshRequire(name: string) {
  delete require.cache[require.resolve(name)]
  return require(name)
}

const DEFAULT_TS_CONFIG: TSConfig = {
  compilerOptions: {}
}

const withMockTsConfig = (config: TSConfig = DEFAULT_TS_CONFIG) => {
  const {tsPath} = freshRequire('../src/ts-node')

  return fancy
    .add('tsPath', () => tsPath)
    .stub(tsNode, 'register', (arg: any) => {
      tsNodeRegisterCallArguments.push(arg)
    })
    .stub(tsPath, 'loadTSConfig', (_: any) => { console.log('asdfasdfasdfasdfasdfasdfasdf'); return config })
    // .do(ctx => console.log(ctx.tsPath.loadTSConfig(null)))
    .finally(() => {
      tsNodeRegisterCallArguments = []
    })
}

describe('tsPath', () => {
  withMockTsConfig()
    .it('should resolve a .ts file', ctx => {
      const result = ctx.tsPath(root, orig)
      expect(result).to.equal(path.join(root, orig))
    })

  withMockTsConfig()
    .it('should leave esModuleInterop undefined by default', ctx => {
      ctx.tsPath(root, orig)
      expect(tsNodeRegisterCallArguments.length).is.equal(1)
      expect(tsNodeRegisterCallArguments[0])
        .to.have.nested.property('compilerOptions.esModuleInterop')
        .equal(undefined)
    })

  withMockTsConfig({
    compilerOptions: {
      esModuleInterop: true
    }
  })
    .it('should use the provided esModuleInterop option', ctx => {
      ctx.tsPath(root, orig)
      expect(tsNodeRegisterCallArguments.length).is.equal(1)
      expect(tsNodeRegisterCallArguments[0])
        .to.have.nested.property('compilerOptions.esModuleInterop')
        .equal(true)
    })
})
