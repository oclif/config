import {ICommand} from './command'
import {IConfig} from './config'
import {IPJSON} from './pjson'
import {IPluginModule} from './plugin'

export interface IHooks {
  init: {}
  update: {}
  'plugins:parse': {
    module: IPluginModule
    pjson: IPJSON
  }
  prerun: {
    Command: ICommand
    argv: string[]
  }
}

export type Hook<T extends {}> = (options: T & {config: IConfig}) => Promise<void>
