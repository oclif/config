// tslint:disable no-implicit-dependencies

import Chalk from 'chalk'
import Indent = require('indent-string')
import * as Wrap from 'wrap-ansi'

import {errtermwidth} from './screen'

export class CLIError extends Error {
  'cli-ux' = {}

  render() {
    let cli
    try { cli = require('cli-ux') } catch {}
    if (cli) return cli.error(this)
    let red: typeof Chalk.red = ((s: string) => s) as any
    try {red = require('chalk').red} catch {}
    let wrap: typeof Wrap = require('wrap-ansi')
    let indent: typeof Indent = require('indent-string')

    let bang = process.platform === 'win32' ? '×' : '✖'
    let output = this.message
    output = wrap(output, errtermwidth, {trim: false, hard: true} as any)
    output = indent(output, 3)
    output = indent(output, 1, red(bang))
    output = indent(output, 1)

    // tslint:disable-next-line no-console
    console.error(output)
  }
}

export class ExitError extends CLIError {
  'cli-ux': {
    exit: number
  }
  code?: string

  constructor(error?: string | Error | number, exitCode = 0) {
    if (typeof error === 'number') {
      exitCode = error
      error = undefined
    }
    const addExitCode = (error: ExitError) => {
      error['cli-ux'] = error['cli-ux'] || {}
      error['cli-ux'].exit = exitCode
      return error
    }
    if (error instanceof Error) {
      return addExitCode(error as any)
    }
    super(error || `EEXIT: ${exitCode}`)
    addExitCode(this)
    this.code = 'EEXIT'
  }
}
