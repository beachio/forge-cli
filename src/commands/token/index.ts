import { Command } from 'commander';
import { registerTokenCreateCommand } from './create.js';
import { registerTokenListCommand } from './list.js';
import { registerTokenRevokeCommand } from './revoke.js';

export function registerTokenCommands(program: Command): void {
  const tokenCmd = program
    .command('token')
    .description('Manage CLI tokens');

  registerTokenCreateCommand(tokenCmd);
  registerTokenListCommand(tokenCmd);
  registerTokenRevokeCommand(tokenCmd);
}
