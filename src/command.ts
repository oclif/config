import {IConfig} from './config'
import {IPlugin} from './plugin'

export interface ICachedCommand {
  _base: string
  id: string
  hidden: boolean
  aliases: string[]
  description?: string
  title?: string
  usage?: string | string[]
  examples?: string[]
  pluginName?: string
  flags: {[name: string]: ICachedFlag}
  args: ICachedArg[]
  load(): Promise<ICommand>
}

export interface IConvertToCachedOptions {
  id?: string
  plugin?: IPlugin
}

export interface ICommand extends ICachedCommand {
  run(argv: string[], opts?: ICommandOptions): Promise<void>
  convertToCached(opts?: IConvertToCachedOptions): ICachedCommand
}

export interface ICommandOptions {
  root?: string
  config?: IConfig
}

export interface ICachedArg {
  name: string
  description?: string
  required?: boolean
  hidden?: boolean
}

export interface ICachedBooleanFlag {
  type: 'boolean'
  name: string
  required?: boolean
  char?: string
  hidden?: boolean
  description?: string
}

export interface ICachedOptionFlag {
  type: 'option'
  name: string
  required?: boolean
  char?: string
  hidden?: boolean
  description?: string
}

export type ICachedFlag = ICachedBooleanFlag | ICachedOptionFlag
