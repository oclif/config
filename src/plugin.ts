import {ICommand} from './command'
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
}
