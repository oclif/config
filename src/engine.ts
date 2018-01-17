import {ICachedCommand} from './command'
import {IPlugin} from './plugin'
import {ITopic} from './topic'

export interface IEngine {
  readonly plugins: IPlugin[]

  readonly topics: ITopic[]
  readonly commands: ICachedCommand[]
  readonly commandIDs: string[]
  readonly rootTopics: ITopic[]
  readonly rootCommands: ICachedCommand[]

  findCommand(id: string, must: true): ICachedCommand
  findCommand(id: string, must?: boolean): ICachedCommand | undefined

  findTopic(id: string, must: true): ITopic
  findTopic(id: string, must?: boolean): ITopic | undefined

  runHook<T extends {}>(event: string, opts: T): Promise<void>
}
