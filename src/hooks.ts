import {ICommand} from './command'
import {IConfig} from './config'
import {IPluginPJSON} from './pjson'
import {IPluginModule} from './plugin'

export interface IHooks {
  init: {}
  update: {}
  'plugins:parse': {
    module: IPluginModule
    pjson: IPluginPJSON
  }
  prerun: {
    Command: ICommand
    argv: string[]
  }
}

export type Hook<T extends {}> = (options: T & {config: IConfig}) => Promise<void>
