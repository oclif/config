import * as _ from 'lodash'
import {Package} from 'read-pkg'

export interface IRawPJSON extends Package {
  name: string
  version: string
  dxcli?: {
    bin?: string
    dirname?: string
    commands?: string
    hooks?: { [name: string]: string | string[] }
    npmRegistry?: string
    plugins?: string[] | string
    topics?: {
      [k: string]: {
        description?: string
        subtopics?: IPJSON['dxcli']['topics']
        hidden?: boolean
      }
    }
  }
}

export interface IPJSON extends IRawPJSON {
  name: string
  version: string
  dxcli: {
    bin?: string
    npmRegistry?: string
    dirname?: string
    commands?: string
    hooks: { [name: string]: string[] }
    plugins?: string[] | string
    topics: {
      [k: string]: {
        description?: string
        subtopics?: IPJSON['dxcli']['topics']
        hidden?: boolean
      }
    }
  }
}

export function normalizePJSON(input: IRawPJSON): IPJSON {
  const dxcli: IRawPJSON['dxcli'] = {...(input.dxcli! || input['cli-engine'])}
  return {
    ...input,
    dxcli: {
      topics: {},
      bin: input.name,
      dirname: dxcli.bin || input.name,
      ...dxcli,
      hooks: _.mapValues(dxcli.hooks, _.castArray),
    },
  }
}
