import {describe, expect, it} from '@dxcli/dev-test'
import * as os from 'os'
import * as path from 'path'

import * as Config from '../src'

const pluginRoot = (plugin: string) => path.resolve(__dirname, '../plugins', plugin)

const testPlugin = (plugin: string, description: string, fn: (config: Config.IConfig) => void) => {
  it(`${plugin}: ${description}`, async () => {
    const config = await Config.read(plugin === '@heroku-cli/config-edit' ? {root: __dirname, name: plugin} : {root: pluginRoot(plugin)})
    fn(config)
  })
}

describe('PluginConfig', () => {
  describe.env().mock(os, 'homedir', () => path.join('/my/home'))('home = /my/home', () => {
    describe.mock(os, 'platform', () => 'darwin')('os = darwin', () => {
      testPlugin('heroku-cli-status', 'sets dirs', config => {
        expect(config).to.include({
          cacheDir: path.join('/my/home/Library/Caches/heroku-cli-status'),
          configDir: path.join('/my/home/.config/heroku-cli-status'),
          errlog: path.join('/my/home/Library/Caches/heroku-cli-status/error.log'),
          dataDir: path.join('/my/home/.local/share/heroku-cli-status'),
          commandsDir: path.join(pluginRoot('heroku-cli-status'), 'src/commands'),
          home: path.join('/my/home'),
        })
      })
    })
    describe.mock(os, 'platform', () => 'linux')('os = linux', () => {
      testPlugin('heroku-cli-status', 'sets dirs', config => {
        expect(config).to.include({
          cacheDir: path.join('/my/home/.cache/heroku-cli-status'),
          configDir: path.join('/my/home/.config/heroku-cli-status'),
          errlog: path.join('/my/home/.cache/heroku-cli-status/error.log'),
          dataDir: path.join('/my/home/.local/share/heroku-cli-status'),
          commandsDir: path.join(pluginRoot('heroku-cli-status'), 'src/commands'),
          home: path.join('/my/home'),
        })
      })
    })
    describe.env({LOCALAPPDATA: '/my/home/localappdata'}).mock(os, 'platform', () => 'win32')('os = win32', () => {
      testPlugin('heroku-cli-status', 'sets dirs', config => {
        expect(config).to.include({
          cacheDir: path.join('/my/home/localappdata/heroku-cli-status'),
          configDir: path.join('/my/home/localappdata/heroku-cli-status'),
          errlog: path.join('/my/home/localappdata/heroku-cli-status/error.log'),
          dataDir: path.join('/my/home/localappdata/heroku-cli-status'),
          commandsDir: path.join(pluginRoot('heroku-cli-status'), 'src/commands'),
          home: path.join('/my/home'),
        })
      })
    })
  })

  testPlugin('heroku-run', 'has properties', config => {
    expect(config).to.include({
      commandsDir: undefined
    })
  })

  testPlugin('@heroku-cli/config-edit', 'has properties', config => {
    expect(config).to.include({
      name: '@heroku-cli/config-edit',
      commandsDir: path.join(__dirname, '../node_modules/@heroku-cli/config-edit/lib/commands'),
    })
  })
})
