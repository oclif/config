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
  'plugins:preinstall': {
    plugin: {
      name: string,
      tag: string,
      type: 'npm'
    }
  }
}

export type HookKeyOrOptions<K> = K extends (keyof Hooks) ? Hooks[K] : K
export type Hook<T> = (this: Hook.Context, options: HookKeyOrOptions<T> & {config: Config.IConfig}) => any

export namespace Hook {
  export type Init = Hook<{
    id: string | undefined,
    argv: string[],
  }>
  export type PluginsPreinstall = Hook<{
    name: string,
    tag: string,
    type: 'npm'
  }>
  export type Prerun = Hook<{
    Command: Config.Command.Class
    argv: string[]
  }>
  export type CommandNotFound = Hook<{
    id: string
  }>

  export interface Context {
    config: Config.IConfig
    exit(code?: number): void
    error(message: string | Error, options?: {code?: string, exit?: number}): void
    warn(message: string): void
    log(message?: any, ...args: any[]): void
    debug(...args: any[]): void
  }
}
