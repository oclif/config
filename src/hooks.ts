import * as Config from '.'

export interface Hooks {
  init: {id: string}
  update: {}
  'command_not_found': {id: string},
  'plugins:parse': {
    pjson: Config.IPlugin
  }
  prerun: {
    Command: Config.Command.Class
    argv: string[]
  }
}

export type Hook<K extends keyof Hooks> = (options: Hooks[K] & {config: Config.IConfig}) => any
