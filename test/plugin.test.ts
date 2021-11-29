import * as path from 'path'

import {expect, fancy} from './test'
import * as Plugin from '../src/plugin'
import * as util from '../src/util'

const root = path.resolve(__dirname, 'fixtures/typescript')
const pluginName = '@oclif/plugin-help'
const pluginLocation = 'some/external/directory'
const pluginPjsonLocation = path.join(pluginLocation, 'package.json')

const withPluginInstance = () => {
  return fancy
  .add('plugin', () => new Plugin.Plugin({
    type: 'core',
    root,
    name: pluginName,
    ignoreManifest: true,
  }))
  .stub(util, 'exists', (checkPath: string) => checkPath === pluginPjsonLocation)
  .stub(util, 'resolvePackage', (id: string): Promise<string> => {
    if (id !== pluginName) {
      return Promise.reject()
    }
    return Promise.resolve(path.join(pluginLocation, 'lib', 'index.js'))
  })
  .stub(util, 'loadJSON', (jsonPath: string) => {
    if (jsonPath !== pluginPjsonLocation) {
      return {}
    }
    return {
      name: pluginName,
      version: '1.0.0',
      files: [],
      oclif: {},
    }
  })
}

describe('Plugin', () => {
  withPluginInstance()
  .it('Should correctly instantiate a Plugin instance', ctx => {
    expect(ctx.plugin).to.be.instanceOf(
      Plugin.Plugin,
      'Expected instance to be an instance of Plugin!',
    )
  })

  withPluginInstance()
  .it('Should correctly load a Plugin', async ctx => {
    await ctx.plugin.load()
  })
})
