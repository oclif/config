import {Package} from 'read-pkg'

export interface PJSON extends Package {
  name: string
  version: string
  anycli: {
    schema?: number
    bin?: string
    npmRegistry?: string
    pluginScope?: string
    dirname?: string
    commands?: string
    hooks?: { [name: string]: string[] }
    plugins?: PJSON.Plugin[]
    devPlugins?: PJSON.Plugin[]
    title?: string
    description?: string
    topics?: {
      [k: string]: {
        description?: string
        subtopics?: PJSON['anycli']['topics']
        hidden?: boolean
      }
    }
  }
}

export namespace PJSON {
  export type Plugin = string | {
    type: 'user'
    name: string
    tag?: string
  } | {
    type: 'link'
    root: string
  }
}
