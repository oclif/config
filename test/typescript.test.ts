import * as path from 'path'

import * as Config from '../src'

import {expect, fancy} from './test'

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
  .it('runs ts command and prerun hooks', async ctx => {
    await ctx.config.runCommand('foo:bar:baz')
    expect(ctx.stdout).to.equal('running ts prerun hook\nit works!\n')
  })

  withConfig
  .stdout()
  .it('runs init hook', async ctx => {
    await ctx.config.runHook('init', {id: 'foo'})
    expect(ctx.stdout).to.equal('running ts init hook\n')
  })
})
