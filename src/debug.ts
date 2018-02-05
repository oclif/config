let debug: any
try { debug = require('debug') } catch {}

export default (...scope: string[]) => (...args: any[]) => {
  if (debug) debug(['@anycli/config', ...scope].join(':'))(...args)
}
