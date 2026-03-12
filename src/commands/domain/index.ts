import { Command } from 'commander';
import { registerDomainCheckCommand } from './check.js';
import { registerDomainSetCommand } from './set.js';

export function registerDomainCommands(program: Command): void {
  const domain = program
    .command('domain')
    .description('Manage custom domains for Forge sites');

  registerDomainCheckCommand(domain);
  registerDomainSetCommand(domain);
}
