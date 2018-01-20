import {ICommand} from './command'
import {IConfig} from './config'
import {IPlugin, IPluginModule} from './plugin'

export interface Hooks {
  init: {id: string}
  update: {}
  'plugins:parse': {
    module: IPluginModule
    pjson: IPlugin
  }
  prerun: {
    Command: ICommand
    argv: string[]
  }
}

export interface IHookReturn {
  exit?: number
}

export type IHook<T extends {}> = (options: T & {config: IConfig}) => Promise<IHookReturn | void>
