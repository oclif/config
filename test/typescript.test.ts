import {expect, fancy} from 'fancy-test'
import * as fs from 'fs-extra'
import * as path from 'path'

import * as Config from '../src'

const root = path.resolve(__dirname, 'fixtures/typescript')

describe('typescript', () => {
  fancy
  .it('has props', async () => {
    const p = (p: string) => path.join(root, p)
    await fs.outputFile(p('.git'), '')
    const config = await Config.read({root})
    expect(config).to.deep.include({
      commandsDir: p('lib/commands'),
      commandsDirTS: p('src/commands'),
      pluginsModule: p('lib/plugins'),
      pluginsModuleTS: p('src/plugins'),
      hooks: {init: [p('lib/hooks/init')]},
      hooksTS: {init: [p('src/hooks/init')]},
    })
  })
})
