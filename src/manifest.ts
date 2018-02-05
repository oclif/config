import * as Globby from 'globby'
import * as path from 'path'

import {Command} from './command'

export interface Manifest {
  version: string
  commands: {[id: string]: Command}
}

const debug = require('debug')('@anycli/config')

export namespace Manifest {
  export type FindCommandCB = (id: string) => Command.Class

  export function build(version: string, dir: string, findCommand: FindCommandCB): Manifest {
    const globby: typeof Globby = require('globby')
    debug(`loading IDs from ${dir}`)
    const ids = globby.sync(['**/*.+(js|ts)', '!**/*.+(d.ts|test.ts|test.js)'], {cwd: dir})
    .map(file => {
      const p = path.parse(file)
      const topics = p.dir.split('/')
      let command = p.name !== 'index' && p.name
      return [...topics, command].filter(f => f).join(':')
    })
    debug('found ids', ids)
    let commands = ids.map(id => {
      try {
        return [id, Command.toCached(findCommand(id))]
      } catch (err) {
        process.emitWarning(err)
      }
    })

    return {
      version,
      commands: commands
      .filter((f): f is [string, Command] => !!f)
      .reduce((commands, [id, c]) => {
        commands[id] = c
        return commands
      }, {} as {[k: string]: Command})
    }
  }
}
