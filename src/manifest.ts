import cli from 'cli-ux'
import * as globby from 'globby'
import * as _ from 'lodash'
import * as path from 'path'

import * as Config from '.'

export interface Manifest {
  version: string
  commands: {[id: string]: Config.Command}
}

const debug = require('debug')('@anycli/config')

export namespace Manifest {
  export type FindCommandCB = (id: string) => Config.Command.Class

  export function build(version: string, dir: string, findCommand: FindCommandCB): Manifest {
    debug(`loading IDs from ${dir}`)
    const ids = globby.sync(['**/*.+(js|ts)', '!**/*.+(d.ts|test.ts|test.js)'], {cwd: dir})
    .map(file => {
      const p = path.parse(file)
      const topics = p.dir.split('/')
      let command = p.name !== 'index' && p.name
      return _([...topics, command]).compact().join(':')
    })
    debug('found ids', ids)
    let commands = ids.map(id => {
      try {
        return [id, Config.Command.toCached(findCommand(id))]
      } catch (err) {
        cli.warn(err)
      }
    })

    return {
      version,
      commands: _(commands)
        .compact()
        .fromPairs()
        .value()
    }
  }
}
