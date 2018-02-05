export class ExitError extends Error {
  'cli-ux': {
    exit: number
  }
  code?: string

  constructor(error?: string | Error | number, exitCode = 0) {
    if (typeof error === 'number') {
      exitCode = error
      error = undefined
    }
    const addCode = (error: ExitError) => {
      error['cli-ux'] = error['cli-ux'] || {}
      error['cli-ux'].exit = exitCode
      return error
    }
    if (error instanceof Error) {
      return addCode(error as any)
    }
    super(error || `${exitCode}: ${status}`)
    this.code = 'EEXIT'
  }
}
