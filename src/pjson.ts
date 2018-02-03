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
    plugins?: (string | PJSON.Plugin)[]
    devPlugins?: (string | PJSON.Plugin)[]
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
  export type Plugin = User | Link
  export interface User {
    type: 'user',
    name: string,
    tag?: string,
  }
  export interface Link {
    type: 'link'
    name: string
    root: string
  }
}
