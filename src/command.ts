import * as Parser from '@anycli/parser'

import * as Config from '.'
import {mapValues} from './util'

export interface Command {
  id: string
  hidden: boolean
  aliases: string[]
  description?: string
  usage?: string | string[]
  examples?: string[]
  type?: string
  pluginName?: string
  pluginType?: string
  flags: {[name: string]: Command.Flag}
  args: Command.Arg[]
}

export namespace Command {
  export interface Arg {
    name: string
    description?: string
    required?: boolean
    hidden?: boolean
    default?: string
    options?: string[]
  }

  export type Flag = Flag.Boolean | Flag.Option

  export namespace Flag {
    export interface Boolean {
      type: 'boolean'
      name: string
      required?: boolean
      char?: string
      hidden?: boolean
      description?: string
    }
    export interface Option {
      type: 'option'
      name: string
      required?: boolean
      char?: string
      hidden?: boolean
      description?: string
      helpValue?: string
      default?: string
      options?: string[]
    }
  }

  export interface Base {
    _base: string
    id: string
    hidden: boolean
    aliases: string[]
    description?: string
    usage?: string | string[]
    examples?: string[]
  }

  export interface Class extends Base {
    plugin?: Config.IPlugin
    flags?: Parser.flags.Input<any>
    args?: Parser.args.Input
    new(argv: string[], config?: Config.LoadOptions): Instance
    run(argv: string[], config?: Config.LoadOptions): Promise<any>
  }

  export interface Instance {
    _run(argv: string[]): Promise<any>
  }

  export interface Plugin extends Command {
    load(): Class
  }

  export function toCached(c: Class, plugin: Config.Plugin): Command {
    return {
      id: c.id,
      description: c.description,
      usage: c.usage,
      pluginName: plugin.name,
      pluginType: plugin.type,
      hidden: c.hidden,
      aliases: c.aliases || [],
      examples: c.examples || (c as any).example,
      flags: mapValues(c.flags || {}, (flag, name) => {
        if (flag.type === 'boolean') {
          return {
            name,
            type: flag.type,
            char: flag.char,
            description: flag.description,
            hidden: flag.hidden,
            required: flag.required,
          }
        }
        return {
          name,
          type: flag.type,
          char: flag.char,
          description: flag.description,
          hidden: flag.hidden,
          required: flag.required,
          helpValue: flag.helpValue,
          options: flag.options,
          default: typeof flag.default === 'function' ? flag.default({options: {}, flags: {}}) : flag.default,
        }
      }),
      args: c.args ? c.args.map(a => ({
        name: a.name,
        description: a.description,
        required: a.required,
        options: a.options,
        default: typeof a.default === 'function' ? a.default({}) : a.default,
        hidden: a.hidden,
      })) : {} as Command['args'],
    }
  }
}
