import * as path from 'path'

import {expect, fancy} from './test'
import * as Plugin from '../src/plugin'
import * as util from '../src/util'

const root = path.resolve(__dirname, 'fixtures/typescript')
const pluginName = '@oclif/plugin-help'
const pluginLocation = 'some/external/directory'

const withPluginInstance = () => {
  return fancy
  .add('plugin', () => new Plugin.Plugin({
    type: 'core',
    root,
    name: pluginName,
    ignoreManifest: true,
  }))
  .stub(util, 'resolvePackage', (id: string): Promise<string> => {
    if (id !== pluginName) {
      return Promise.reject()
    }
    return Promise.resolve(pluginLocation)
  })
  .stub(util, 'loadJSON', (jsonPath: string) => {
    if (jsonPath !== pluginLocation) {
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
