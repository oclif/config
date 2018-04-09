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
    const checkTemplate = (k: keyof Config.PJSON.Plugin['oclif']['update']['s3']['templates'], expected: string, extra: any = {}) => {
      expect(_.template(config.pjson.oclif.update.s3.templates[k])({
        ...config,
        bin: 'oclif-cli',
        version: '1.0.0',
        ...extra
      })).to.equal(expected)
    }
    checkTemplate('platformBaseDir', 'oclif-cli')
    checkTemplate('vanillaBaseDir', 'oclif-cli')
    checkTemplate('platformTarball', '@oclif/config/oclif-cli-v1.0.0/oclif-cli-v1.0.0-darwin-x64')
    checkTemplate('platformManifest', '@oclif/config/darwin-x64')
    checkTemplate('vanillaManifest', '@oclif/config/version')
    checkTemplate('vanillaTarball', '@oclif/config/channels/beta/oclif-cli-v2.0.0-beta/oclif-cli-v2.0.0-beta', {version: '2.0.0-beta', channel: 'beta'})
    checkTemplate('platformTarball', '@oclif/config/channels/beta/oclif-cli-v2.0.0-beta/oclif-cli-v2.0.0-beta-darwin-x64', {version: '2.0.0-beta', channel: 'beta'})
    checkTemplate('platformManifest', '@oclif/config/channels/beta/darwin-x64', {version: '2.0.0-beta', channel: 'beta'})
    checkTemplate('vanillaManifest', '@oclif/config/channels/beta/version', {version: '2.0.0-beta', channel: 'beta'})
    checkTemplate('vanillaTarball', '@oclif/config/channels/beta/oclif-cli-v2.0.0-beta/oclif-cli-v2.0.0-beta', {version: '2.0.0-beta', channel: 'beta'})
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
