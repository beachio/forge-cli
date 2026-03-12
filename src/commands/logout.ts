import { Command } from 'commander';
import { clearCredentials, hasStoredCredentials } from '../auth/token-store.js';
import { handleCommandResult } from '../utils/output.js';
import * as logger from '../utils/logger.js';

export function registerLogoutCommand(program: Command): void {
  program
    .command('logout')
    .description('Clear stored credentials')
    .action(async () => {
      if (!hasStoredCredentials()) {
        logger.info('No stored credentials found.');
        return;
      }

      clearCredentials();
      handleCommandResult({ success: true }, 'Logged out. Credentials cleared.');
    });
}
