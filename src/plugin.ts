import {ICachedCommand} from './command'
import {IConfig} from './config'
import {ITopic} from './topic'

export interface IPlugin {
  name: string
  version: string
  type: string
  root: string
  tag?: string
  config: IConfig
  commands: ICachedCommand[]
  topics: ITopic[]
  plugins: IPlugin[]
  hooks: {[k: string]: string[]}
}
