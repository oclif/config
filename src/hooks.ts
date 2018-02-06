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

export type Hook<K extends keyof Hooks> = (this: Hook.Context, options: Hooks[K] & {config: Config.IConfig}) => any

export namespace Hook {
  export interface Context {
    exit(code?: number): void
    error(message: string | Error, options?: {code?: string, exit?: number}): void
    warn(message: string): void
    log(message?: any): void
  }
}
