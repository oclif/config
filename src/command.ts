import {IConfig} from './config'
import {IPlugin} from './plugin'

export interface ICachedCommand {
  _base: string
  id: string
  hidden: boolean
  aliases: string[]
  description: string
  usage: string
  plugin: IPlugin
  help: string
  load(): ICommand
}

export interface ICommand extends ICachedCommand {
  run(argv: string[], config: IConfig): Promise<void>
}
