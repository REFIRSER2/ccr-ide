import { Command } from 'commander';
import { APP_NAME, APP_VERSION } from '../shared/constants.js';
import { createServerCommand } from './server-cmd.js';
import { createConnectCommand } from './connect-cmd.js';

const program = new Command()
  .name('ccr')
  .description('Claude Code Remote CLI - Control Claude Code CLI remotely')
  .version(APP_VERSION);

program.addCommand(createServerCommand());
program.addCommand(createConnectCommand());

program.parse(process.argv);
