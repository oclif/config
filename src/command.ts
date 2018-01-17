import {IConfig} from './config'
import {IPlugin} from './plugin'

export interface ICachedCommand {
  id?: string
  base: string
  hidden: boolean
  aliases: string[]
  description: string
  usage: string
  plugin: IPlugin
  help: string
}

export interface ICommand extends ICachedCommand {
  run(argv: string[], config: IConfig): Promise<void>
}
