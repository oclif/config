import * as os from 'os'
import * as path from 'path'

import {IConfig, load, PJSON} from '../src'

import {expect, fancy} from './test'

interface Options {
  homedir?: string,
    platform?: string,
    env?: {[k: string]: string},
}

describe('Config', () => {
  const testConfig = ({homedir = '/my/home', platform = 'darwin', env = {}}: Options = {}) => {
    const test = fancy
    .resetConfig()
    .env(env, {clear: true})
    .stub(os, 'homedir', () => path.join(homedir))
    .stub(os, 'platform', () => platform)
    .add('config', () => load())

    return {
      hasS3Key(k: keyof PJSON.S3.Templates, expected: string, extra: any = {}) {
        return this
        .it(`renders ${k} template as ${expected}`, config => {
          let {ext, ...options} = extra
          options = {
            bin: 'oclif-cli',
            version: '1.0.0',
            ext: '.tar.gz',
            ...options,
          }
          const o = ext ? config.s3Key(k as any, ext, options) : config.s3Key(k, options)
          expect(o).to.equal(expected)
        })
      },
      hasProperty<K extends keyof IConfig>(k: K | undefined, v: IConfig[K] | undefined) {
        return this
        .it(`has ${k}=${v}`, config => expect(config).to.have.property(k!, v))
      },
      it(expectation: string, fn: (config: IConfig) => any) {
        test
        .do(({config}) => fn(config))
        .it(expectation)
        return this
      }
    }
  }

  describe('darwin', () => {
    testConfig()
    .hasProperty('cacheDir', path.join('/my/home/Library/Caches/@oclif/config'))
    .hasProperty('configDir', path.join('/my/home/.config/@oclif/config'))
    .hasProperty('errlog', path.join('/my/home/Library/Caches/@oclif/config/error.log'))
    .hasProperty('dataDir', path.join('/my/home/.local/share/@oclif/config'))
    .hasProperty('home', path.join('/my/home'))
  })

  describe('linux', () => {
    testConfig({platform: 'linux'})
    .hasProperty('cacheDir', path.join('/my/home/.cache/@oclif/config'))
    .hasProperty('configDir', path.join('/my/home/.config/@oclif/config'))
    .hasProperty('errlog', path.join('/my/home/.cache/@oclif/config/error.log'))
    .hasProperty('dataDir', path.join('/my/home/.local/share/@oclif/config'))
    .hasProperty('home', path.join('/my/home'))
  })

  describe('win32', () => {
    testConfig({
      platform: 'win32',
      env: {LOCALAPPDATA: '/my/home/localappdata'},
    })
    .hasProperty('cacheDir', path.join('/my/home/localappdata/@oclif\\config'))
    .hasProperty('configDir', path.join('/my/home/localappdata/@oclif\\config'))
    .hasProperty('errlog', path.join('/my/home/localappdata/@oclif\\config/error.log'))
    .hasProperty('dataDir', path.join('/my/home/localappdata/@oclif\\config'))
    .hasProperty('home', path.join('/my/home'))
  })

  describe('s3Key', () => {
    const target = {platform: 'darwin', arch: 'x64'}
    const beta = {version: '2.0.0-beta', channel: 'beta'}
    testConfig()
    .hasS3Key('baseDir', 'oclif-cli')
    .hasS3Key('manifest', '@oclif/config/version')
    .hasS3Key('manifest', '@oclif/config/channels/beta/version', beta)
    .hasS3Key('manifest', '@oclif/config/darwin-x64', target)
    .hasS3Key('manifest', '@oclif/config/channels/beta/darwin-x64', {...beta, ...target})
    .hasS3Key('unversioned', '@oclif/config/oclif-cli.tar.gz')
    .hasS3Key('unversioned', '@oclif/config/oclif-cli.tar.gz')
    .hasS3Key('unversioned', '@oclif/config/channels/beta/oclif-cli.tar.gz', beta)
    .hasS3Key('unversioned', '@oclif/config/channels/beta/oclif-cli.tar.gz', beta)
    .hasS3Key('unversioned', '@oclif/config/oclif-cli-darwin-x64.tar.gz', target)
    .hasS3Key('unversioned', '@oclif/config/oclif-cli-darwin-x64.tar.gz', target)
    .hasS3Key('unversioned', '@oclif/config/channels/beta/oclif-cli-darwin-x64.tar.gz', {...beta, ...target})
    .hasS3Key('unversioned', '@oclif/config/channels/beta/oclif-cli-darwin-x64.tar.gz', {...beta, ...target})
    .hasS3Key('versioned', '@oclif/config/oclif-cli-v1.0.0/oclif-cli-v1.0.0.tar.gz')
    .hasS3Key('versioned', '@oclif/config/oclif-cli-v1.0.0/oclif-cli-v1.0.0-darwin-x64.tar.gz', target)
    .hasS3Key('versioned', '@oclif/config/channels/beta/oclif-cli-v2.0.0-beta/oclif-cli-v2.0.0-beta.tar.gz', beta)
    .hasS3Key('versioned', '@oclif/config/channels/beta/oclif-cli-v2.0.0-beta/oclif-cli-v2.0.0-beta-darwin-x64.tar.gz', {...beta, ...target})
  })
})
