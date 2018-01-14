import * as _ from 'lodash'
import {Package} from 'read-pkg-up'

export interface IRawPJSONBase extends Package {
  name: string
  version: string
  dxcli?: {
    bin?: string
    dirname?: string
    commands?: string
    hooks?: { [name: string]: string | string[] }
    plugins?: string[] | string
    topics?: {
      [k: string]: {
        description?: string
        subtopics?: IPJSONBase['dxcli']['topics']
        hidden?: boolean
      }
    }
  }
}

export interface IRawPluginPJSON extends IRawPJSONBase {
  dxcli?: IRawPJSONBase['dxcli'] & {
    type?: 'plugin'
  }
}

export interface IRawCLIPJSON extends IRawPJSONBase {
  dxcli: IRawPJSONBase['dxcli'] & {
    type: 'cli'
    npmRegistry?: string
  }
}

export interface IPJSONBase extends IRawPJSONBase {
  name: string
  version: string
  dxcli: {
    bin: string
    dirname: string
    commands?: string
    hooks: { [name: string]: string[] }
    plugins?: string[] | string
    topics: {
      [k: string]: {
        description?: string
        subtopics?: IPJSONBase['dxcli']['topics']
        hidden?: boolean
      }
    }
  }
}

export interface IPluginPJSON extends IPJSONBase {
  dxcli: IPJSONBase['dxcli'] & {
    type: 'plugin'
  }
}

export interface ICLIPJSON extends IPJSONBase {
  dxcli: IPJSONBase['dxcli'] & {
    type: 'cli'
    npmRegistry?: string
  }
}

export type IPJSON = IPluginPJSON | ICLIPJSON

export function normalizePJSON(pjson: IRawCLIPJSON): ICLIPJSON
export function normalizePJSON(pjson: IRawPluginPJSON): IPluginPJSON
export function normalizePJSON(input: IRawPluginPJSON | IRawCLIPJSON): any {
  const dxcli: IRawPluginPJSON['dxcli'] | IRawCLIPJSON['dxcli'] = {...(input.dxcli! || input['cli-engine'])}
  dxcli.hooks = _.mapValues(dxcli.hooks, _.castArray)
  dxcli.type = dxcli.type || 'plugin'
  dxcli.bin = dxcli.bin || input.name
  dxcli.dirname = dxcli.dirname || dxcli.bin
  dxcli.topics = dxcli.topics || {}
  return {
    ...input,
    dxcli,
  }
}
