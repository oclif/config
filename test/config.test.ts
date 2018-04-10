import * as _ from 'lodash'
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
      cacheDir: path.join('/my/home/Library/Caches/@oclif/config'),
      configDir: path.join('/my/home/.config/@oclif/config'),
      errlog: path.join('/my/home/Library/Caches/@oclif/config/error.log'),
      dataDir: path.join('/my/home/.local/share/@oclif/config'),
      home: path.join('/my/home'),
    })
    const checkTemplate = (type: 'target' | 'vanilla', k: keyof Config.PJSON.Plugin['oclif']['update']['s3']['templates']['vanilla'], expected: string, extra: any = {}) => {
      expect(_.template(config.pjson.oclif.update.s3.templates[type][k])({
        ...config,
        bin: 'oclif-cli',
        version: '1.0.0',
        ext: '.tar.gz',
        ...extra
      })).to.equal(expected)
    }
    checkTemplate('target', 'baseDir', 'oclif-cli')
    checkTemplate('vanilla', 'baseDir', 'oclif-cli')
    checkTemplate('target', 'versioned', '@oclif/config/oclif-cli-v1.0.0/oclif-cli-v1.0.0-darwin-x64.tar.gz')
    checkTemplate('target', 'unversioned', '@oclif/config/oclif-cli-darwin-x64.tar.gz')
    checkTemplate('target', 'manifest', '@oclif/config/darwin-x64')
    checkTemplate('vanilla', 'manifest', '@oclif/config/version')
    checkTemplate('vanilla', 'versioned', '@oclif/config/oclif-cli-v1.0.0/oclif-cli-v1.0.0.tar.gz')
    checkTemplate('vanilla', 'unversioned', '@oclif/config/oclif-cli.tar.gz')
    checkTemplate('target', 'versioned', '@oclif/config/channels/beta/oclif-cli-v2.0.0-beta/oclif-cli-v2.0.0-beta-darwin-x64.tar.gz', {version: '2.0.0-beta', channel: 'beta'})
    checkTemplate('target', 'unversioned', '@oclif/config/channels/beta/oclif-cli-darwin-x64.tar.gz', {version: '2.0.0-beta', channel: 'beta'})
    checkTemplate('target', 'manifest', '@oclif/config/channels/beta/darwin-x64', {version: '2.0.0-beta', channel: 'beta'})
    checkTemplate('vanilla', 'manifest', '@oclif/config/channels/beta/version', {version: '2.0.0-beta', channel: 'beta'})
    checkTemplate('vanilla', 'versioned', '@oclif/config/channels/beta/oclif-cli-v2.0.0-beta/oclif-cli-v2.0.0-beta.tar.gz', {version: '2.0.0-beta', channel: 'beta'})
    checkTemplate('vanilla', 'unversioned', '@oclif/config/channels/beta/oclif-cli.tar.gz', {version: '2.0.0-beta', channel: 'beta'})
  })

  fancy
  .resetConfig()
  .env({}, {clear: true})
  .stub(os, 'homedir', () => path.join('/my/home'))
  .stub(os, 'platform', () => 'linux')
  .add('config', () => Config.load())
  .end('linux', ({config}) => {
    expect(config).to.include({
      cacheDir: path.join('/my/home/.cache/@oclif/config'),
      configDir: path.join('/my/home/.config/@oclif/config'),
      errlog: path.join('/my/home/.cache/@oclif/config/error.log'),
      dataDir: path.join('/my/home/.local/share/@oclif/config'),
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
      cacheDir: path.join('/my/home/localappdata/@oclif\\config'),
      configDir: path.join('/my/home/localappdata/@oclif\\config'),
      errlog: path.join('/my/home/localappdata/@oclif\\config/error.log'),
      dataDir: path.join('/my/home/localappdata/@oclif\\config'),
      home: path.join('/my/home'),
    })
  })
})
