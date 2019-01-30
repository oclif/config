import * as path from 'path'
import * as proxyquire from 'proxyquire'
// import * as rewire from 'rewire'
import * as tsNode from 'ts-node'

import {TSConfig} from '../src/ts-node'

import {expect, fancy} from './test'

const root = path.resolve(__dirname, 'fixtures/typescript')
const orig = 'src/hooks/init.ts'
let tsNodeRegisterCallArguments: any[] = []

/**
 * Delete a module from the require cache before requiring it.
 */
// export default function freshRequire(name: string) {
//   delete require.cache[require.resolve(name)]
//   return require(name)
// }

const DEFAULT_TS_CONFIG: TSConfig = {
  compilerOptions: {}
}

const withMockTsConfig = (config: TSConfig = DEFAULT_TS_CONFIG) => {
  const stubLoader = (_: any) => {
    console.log('loadTSConfig proxyquire')
    return config
  }
  const tsNodePlugin = proxyquire('../src/ts-node', {'loadTSConfig': stubLoader})

  // This prints "loadTSConfig unstubbed" not "loadTSConfig proxyquire"!
  tsNodePlugin.tsPath('poop', 'asdf')

  return fancy
    .add('tsNodePlugin', () => tsNodePlugin)
    .stub(tsNode, 'register', (arg: any) => {
      tsNodeRegisterCallArguments.push(arg)
    })
    .finally(() => {
      tsNodeRegisterCallArguments = []
    })
}

describe('tsPath', () => {
  withMockTsConfig()
    .it('should resolve a .ts file', ctx => {
      const result = ctx.tsNodePlugin.tsPath(root, orig)
      expect(result).to.equal(path.join(root, orig))
    })

  withMockTsConfig()
    .it('should leave esModuleInterop undefined by default', ctx => {
      ctx.tsNodePlugin.tsPath(root, orig)
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
      ctx.tsNodePlugin.tsPath(root, orig)
      expect(tsNodeRegisterCallArguments.length).is.equal(1)
      expect(tsNodeRegisterCallArguments[0])
        .to.have.nested.property('compilerOptions.esModuleInterop')
        .equal(true)
    })
})
