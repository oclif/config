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
  'plugins:install': {
    plugin: {
      name: string,
      tag: string,
      type: 'npm'
    }
  }
}

export type Hook<K extends keyof Hooks> = (this: Hook.Context, options: Hooks[K] & {config: Config.IConfig}) => any

export namespace Hook {
  export interface Context {
    config: Config.IConfig
    exit(code?: number): void
    error(message: string | Error, options?: {code?: string, exit?: number}): void
    warn(message: string): void
    log(message?: any, ...args: any[]): void
    debug(...args: any[]): void
  }
}
