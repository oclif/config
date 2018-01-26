import {expect, fancy} from 'fancy-test'
import * as os from 'os'
import * as path from 'path'

import * as Config from '../src'

const pluginRoot = (plugin: string) => path.resolve(__dirname, '../plugins', plugin)

const testPlugin = (plugin: string) => async () => {
  const config = await Config.read(plugin === '@heroku-cli/config-edit' ? {root: __dirname, name: plugin} : {root: pluginRoot(plugin)})
  return {config}
}

describe('PluginConfig', () => {
  fancy
  .env({}, {clear: true})
  .stub(os, 'homedir', () => path.join('/my/home'))
  .stub(os, 'platform', () => 'darwin')
  .add('config', testPlugin('heroku-cli-status'))
  .end('darwin', ({config}) => {
    expect(config.config).to.include({
      cacheDir: path.join('/my/home/Library/Caches/heroku-cli-status'),
      configDir: path.join('/my/home/.config/heroku-cli-status'),
      errlog: path.join('/my/home/Library/Caches/heroku-cli-status/error.log'),
      dataDir: path.join('/my/home/.local/share/heroku-cli-status'),
      commandsDir: path.join(pluginRoot('heroku-cli-status'), 'lib/commands'),
      home: path.join('/my/home'),
    })
  })

  fancy
  .env({}, {clear: true})
  .stub(os, 'homedir', () => path.join('/my/home'))
  .stub(os, 'platform', () => 'linux')
  .add('config', testPlugin('heroku-cli-status'))
  .end('linux', ({config}) => {
    expect(config.config).to.include({
      cacheDir: path.join('/my/home/.cache/heroku-cli-status'),
      configDir: path.join('/my/home/.config/heroku-cli-status'),
      errlog: path.join('/my/home/.cache/heroku-cli-status/error.log'),
      dataDir: path.join('/my/home/.local/share/heroku-cli-status'),
      commandsDir: path.join(pluginRoot('heroku-cli-status'), 'lib/commands'),
      home: path.join('/my/home'),
    })
  })

  fancy
  .env({LOCALAPPDATA: '/my/home/localappdata'}, {clear: true})
  .stub(os, 'homedir', () => path.join('/my/home'))
  .stub(os, 'platform', () => 'win32')
  .add('config', testPlugin('heroku-cli-status'))
  .end('win32', ({config}) => {
    expect(config.config).to.include({
      cacheDir: path.join('/my/home/localappdata/heroku-cli-status'),
      configDir: path.join('/my/home/localappdata/heroku-cli-status'),
      errlog: path.join('/my/home/localappdata/heroku-cli-status/error.log'),
      dataDir: path.join('/my/home/localappdata/heroku-cli-status'),
      commandsDir: path.join(pluginRoot('heroku-cli-status'), 'lib/commands'),
      home: path.join('/my/home'),
    })
  })

  fancy
  .add('config', testPlugin('heroku-run'))
  .end('heroku-run has properties', ({config}) => {
    expect(config.config).to.include({
      commandsDir: undefined
    })
  })

  fancy
  .add('plugin', testPlugin('@heroku-cli/config-edit'))
  .end('@heroku-cli/config-edit has properties', ({plugin}) => {
    expect(plugin.config).to.include({
      name: '@heroku-cli/config-edit',
      commandsDir: path.join(__dirname, '../node_modules/@heroku-cli/config-edit/lib/commands'),
    })
  })
})
