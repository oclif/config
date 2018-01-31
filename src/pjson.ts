import {Package} from 'read-pkg'

export interface IPJSON extends Package {
  name: string
  version: string
  anycli: {
    bin?: string
    npmRegistry?: string
    dirname?: string
    commands?: string
    hooks: { [name: string]: string[] }
    plugins?: string[] | string
    devPlugins?: string[]
    title?: string
    description?: string
    topics: {
      [k: string]: {
        description?: string
        subtopics?: IPJSON['anycli']['topics']
        hidden?: boolean
      }
    }
  }
}
