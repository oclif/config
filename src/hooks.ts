import * as Config from '.'

export interface Hooks {
  [event: string]: object
  init: {
    id: string | undefined,
    argv: string[],
  }
  prerun: {
    Command: Config.Command.Class
    argv: string[]
  }
  update: {}
  'command_not_found': {id: string},
  'plugins:parse': {
    pjson: Config.IPlugin
  }
}

export type Hook<K extends keyof Hooks> = (options: Hooks[K] & {config: Config.IConfig}) => any
