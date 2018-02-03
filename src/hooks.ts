import * as Config from '.'

export interface Hooks {
  init: {argv: string[]}
  prerun: {
    command: Config.Command
    argv: string[]
  }
  update: {}
  'command_not_found': {id: string},
  'plugins:parse': {
    pjson: Config.IPlugin
  }
}

export type Hook<K extends keyof Hooks> = (options: Hooks[K] & {config: Config.IConfig}) => any
