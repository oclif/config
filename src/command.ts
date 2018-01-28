import {IConfig} from './config'

export interface ICachedCommand {
  _base: string
  id: string
  hidden: boolean
  aliases: string[]
  description?: string
  usage?: string
  plugin?: {
    name: string
    version: string
    type: string
    root: string
    tag?: string
  }
  help?: string
  load(): Promise<ICommand>
}

export interface ICommand extends ICachedCommand {
  run(argv: string[], opts?: ICommandOptions): Promise<void>
  convertToCached(): ICachedCommand
}

export interface ICommandOptions {
  root?: string
  config?: IConfig
}
