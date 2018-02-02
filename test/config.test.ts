import {expect, fancy} from 'fancy-test'
import * as os from 'os'
import * as path from 'path'

import * as Config from '../src'

describe('PluginConfig', () => {
  fancy
  .env({}, {clear: true})
  .stub(os, 'homedir', () => path.join('/my/home'))
  .stub(os, 'platform', () => 'darwin')
  .add('config', Config.read)
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
  .env({}, {clear: true})
  .stub(os, 'homedir', () => path.join('/my/home'))
  .stub(os, 'platform', () => 'linux')
  .add('config', Config.read)
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
  .env({LOCALAPPDATA: '/my/home/localappdata'}, {clear: true})
  .stub(os, 'homedir', () => path.join('/my/home'))
  .stub(os, 'platform', () => 'win32')
  .add('config', Config.read)
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
