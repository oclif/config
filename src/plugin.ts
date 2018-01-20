import {ICachedCommand, ICommand} from './command'
import {IConfig} from './config'
import {ITopic} from './topic'

export interface IPluginModule {
  commands: ICommand[]
  topic?: ITopic
  topics: ITopic[]
}

export interface IPlugin {
  name: string
  version: string
  type: string
  root: string
  config: IConfig
  module?: IPluginModule
  commands: ICachedCommand[]
  topics: ITopic[]
  plugins: IPlugin[]
  hooks: {[k: string]: string[]}
}
