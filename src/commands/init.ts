import { Command } from 'commander';
import inquirer from 'inquirer';
import { writeForgeConfig, hasForgeConfig, readForgeConfig } from '../config/forge-config.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';
import type { ForgeConfig } from '../config/forge-config.js';

export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a forge.json configuration file')
    .option('--force', 'Overwrite existing forge.json')
    .action(async (options) => {
      if (hasForgeConfig() && !options.force) {
        logger.warn('forge.json already exists. Use --force to overwrite.');
        return;
      }

      const existing = readForgeConfig() || {};

      const answers = await inquirer.prompt([
        {
          type: 'input',
          name: 'site',
          message: 'Site name (e.g., my-site.getforge.io):',
          default: existing.site,
        },
        {
          type: 'input',
          name: 'deploy_directory',
          message: 'Deploy directory:',
          default: existing.deploy_directory || '.',
        },
        {
          type: 'input',
          name: 'compiler',
          message: 'Compiler mode (none, jekyll, middleman):',
          default: existing.compiler || 'none',
        },
      ]);

      const config: ForgeConfig = {
        site: answers.site || undefined,
        deploy_directory: answers.deploy_directory,
        compiler: answers.compiler,
        ignore: existing.ignore || ['node_modules', '.git', '.env'],
      };

      writeForgeConfig(config);
      handleCommandResult(config, 'forge.json created.');
    });
}
