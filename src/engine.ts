import {ICommand} from './command'
import {IPlugin} from './plugin'
import {ITopic} from './topic'

export interface IEngine extends ICommand {
  readonly plugins: IPlugin[]

  readonly topics: ITopic[]
  readonly commands: ICommand[]
  readonly commandIDs: string[]
  readonly rootTopics: ITopic[]
  readonly rootCommands: ICommand[]

  findCommand(id: string, must: true): ICommand
  findCommand(id: string, must?: boolean): ICommand | undefined

  findTopic(id: string, must: true): ITopic
  findTopic(id: string, must?: boolean): ITopic | undefined

  runHook<T extends {}>(event: string, opts: T): Promise<void>
}
