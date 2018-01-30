import {ICachedCommand} from './command'
import {IConfig} from './config'
import {IPlugin} from './plugin'
import {ITopic} from './topic'

export interface IEngine {
  readonly config: IConfig
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

  load(config: IConfig): Promise<void>
}
