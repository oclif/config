import * as os from 'os'
import * as path from 'path'

import * as Config from '../src'

import {expect, fancy} from './test'

describe('PluginConfig', () => {
  fancy
  .resetConfig()
  .env({}, {clear: true})
  .stub(os, 'homedir', () => path.join('/my/home'))
  .stub(os, 'platform', () => 'darwin')
  .add('config', () => Config.load())
  .end('darwin', ({config}) => {
    expect(config).to.include({
      cacheDir: path.join('/my/home/Library/Caches/@anycli/config'),
      configDir: path.join('/my/home/.config/@anycli/config'),
      errlog: path.join('/my/home/Library/Caches/@anycli/config/error.log'),
      dataDir: path.join('/my/home/.local/share/@anycli/config'),
      home: path.join('/my/home'),
    })
  })

  fancy
  .resetConfig()
  .env({}, {clear: true})
  .stub(os, 'homedir', () => path.join('/my/home'))
  .stub(os, 'platform', () => 'linux')
  .add('config', () => Config.load())
  .end('linux', ({config}) => {
    expect(config).to.include({
      cacheDir: path.join('/my/home/.cache/@anycli/config'),
      configDir: path.join('/my/home/.config/@anycli/config'),
      errlog: path.join('/my/home/.cache/@anycli/config/error.log'),
      dataDir: path.join('/my/home/.local/share/@anycli/config'),
      home: path.join('/my/home'),
    })
  })

  fancy
  .resetConfig()
  .env({LOCALAPPDATA: '/my/home/localappdata'}, {clear: true})
  .stub(os, 'homedir', () => path.join('/my/home'))
  .stub(os, 'platform', () => 'win32')
  .add('config', () => Config.load())
  .end('win32', ({config}) => {
    expect(config).to.include({
      cacheDir: path.join('/my/home/localappdata/@anycli/config'),
      configDir: path.join('/my/home/localappdata/@anycli/config'),
      errlog: path.join('/my/home/localappdata/@anycli/config/error.log'),
      dataDir: path.join('/my/home/localappdata/@anycli/config'),
      home: path.join('/my/home'),
    })
  })
})
