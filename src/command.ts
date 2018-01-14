import {IConfig} from './config'

export interface ICachedCommand {
  id?: string
  hidden: boolean
  base: string
  aliases: string[]
  // help(config: IConfig): string
  // helpLine(config: IConfig): [string, string | undefined]
  load(): Promise<ICommand>
}

export interface ICommand extends ICachedCommand {
  base: '@cli-engine/command@1.0.0'
  run(argv: string[], config: IConfig): Promise<void>
}
