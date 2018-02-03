import {expect, fancy} from 'fancy-test'
import * as path from 'path'

import * as Config from '../src'

const root = path.resolve(__dirname, 'fixtures/typescript')
const p = (p: string) => path.join(root, p)

const withConfig = fancy
.add('config', () => Config.load(root))

describe('typescript', () => {
  withConfig
  .it('has commandsDir', ({config}) => {
    expect(config).to.deep.include({
      commandsDir: p('src/commands'),
    })
  })

  withConfig
  .stdout()
  .it('runs ts command', async ctx => {
    ctx.config.runCommand('foo:bar:baz')
    expect(ctx.stdout).to.equal('it works!\n')
  })
})
