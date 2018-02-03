import * as Parser from '@anycli/parser'
import * as _ from 'lodash'

import * as Config from '.'

export interface Command {
  id: string
  hidden: boolean
  aliases: string[]
  description?: string
  title?: string
  usage?: string | string[]
  examples?: string[]
  type?: string
  flags: {[name: string]: Command.Flag.Boolean | Command.Flag.Option}
  args: {
    name: string
    description?: string
    required?: boolean
    hidden?: boolean
    default?: string
    options?: string[]
  }[]
}

export namespace Command {
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
    title?: string
    usage?: string | string[]
    examples?: string[]
  }

  export interface Full extends Base {
    plugin?: Config.IPlugin
    flags?: Parser.flags.Input<any>
    args?: Parser.args.Input
    new<T>(argv: string[], config?: Config.Options): T
    run(argv: string[], config?: Config.Options): Promise<any>
  }

  export interface Plugin extends Command {
    load(): Full
  }

  export function toCached(c: Full): Command {
    return {
      title: c.title,
      id: c.id,
      description: c.description,
      usage: c.usage,
      hidden: c.hidden,
      aliases: c.aliases || [],
      flags: _.mapValues(c.flags || {}, (flag, name) => {
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
          default: _.isFunction(flag.default) ? flag.default({options: {}, flags: {}}) : flag.default,
        }
      }),
      args: c.args ? c.args.map(a => ({
        name: a.name,
        description: a.description,
        required: a.required,
        options: a.options,
        default: _.isFunction(a.default) ? a.default({}) : a.default,
        hidden: a.hidden,
      })) : {} as Command['args'],
    }
  }
}
