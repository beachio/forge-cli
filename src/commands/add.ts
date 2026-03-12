import { Command } from 'commander';
import { writeForgeConfig, readForgeConfig } from '../config/forge-config.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';

export function registerAddCommand(program: Command): void {
  program
    .command('add <site>')
    .description('Link the current directory to a remote Forge site')
    .action(async (site: string) => {
      const existing = readForgeConfig() || {};

      writeForgeConfig({
        ...existing,
        site,
      });

      handleCommandResult(
        { success: true, site, directory: process.cwd() },
        `Linked to "${site}". Deploy with \`forge deploy\`.`,
      );
    });
}
