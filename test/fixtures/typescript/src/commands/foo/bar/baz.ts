import Command from '@anycli/command'
import cli from 'cli-ux'

export default class extends Command {
  async run() {
    cli.log('it works!')
  }
}
