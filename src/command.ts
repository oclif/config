import * as Parser from '@anycli/parser'

import {IConfig} from './config'

export interface ICommandBase {
  _base: string
  id: string
  hidden: boolean
  aliases: string[]
  description?: string
  title?: string
  usage?: string | string[]
  examples?: string[]
  pluginName?: string
  type?: string
}

export interface ICachedCommand extends ICommandBase {
  flags: {[name: string]: ICachedFlag}
  args: ICachedArg[]
  load(): Promise<ICommand>
}

export interface IConvertToCachedOptions {
  id?: string
  pluginName?: string
}

export interface ICommand<T = any> extends ICommandBase {
  flags?: Parser.flags.Input<any>
  args?: Parser.args.Input
  new (argv: string[], opts: ICommandOptions): T
  run(this: ICommand<T>, argv: string[], opts?: Partial<ICommandOptions>): Promise<void>
  convertToCached(opts?: IConvertToCachedOptions): ICachedCommand
}

export interface ICommandOptions {
  root?: string
  config: IConfig
}

export interface ICachedArg {
  name: string
  description?: string
  required?: boolean
  hidden?: boolean
  default?: string
  options?: string[]
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
  helpValue?: string
  default?: string
  options?: string[]
}

export type ICachedFlag = ICachedBooleanFlag | ICachedOptionFlag
