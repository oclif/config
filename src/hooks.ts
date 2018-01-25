import {ICommand} from './command'
import {ICLIConfig} from './config'
import {IPlugin, IPluginModule} from './plugin'

export interface Hooks {
  init: {id: string}
  update: {}
  'command_not_found': {id: string},
  'plugins:parse': {
    module: IPluginModule
    pjson: IPlugin
  }
  prerun: {
    Command: ICommand
    argv: string[]
  }
}

export type IHook<T extends {}> = (options: T & {config: ICLIConfig}) => any
