import { Command } from 'commander';
import { getStoredCredentials, hasStoredCredentials } from '../auth/token-store.js';
import { getOptionalAuth } from '../auth/resolver.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';

export function registerWhoamiCommand(program: Command): void {
  program
    .command('whoami')
    .description('Show current authentication status')
    .action(async (_, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      const auth = getOptionalAuth({
        token: parentOpts.token,
        siteToken: parentOpts.siteToken,
      });

      if (!auth) {
        logger.info('Not authenticated. Run `forge login` to get started.');
        return;
      }

      const stored = getStoredCredentials();

      const info = {
        authenticated: true,
        token_type: auth.tokenType,
        source: auth.source,
        user_email: stored?.user_email,
        user_name: stored?.user_name,
        expires_at: stored?.expires_at,
        has_site_tokens: stored?.site_tokens ? Object.keys(stored.site_tokens).length : 0,
        organisation_id: stored?.organisation_id ?? null,
        organisation_name: stored?.organisation_name ?? null,
      };

      handleCommandResult(info);

      if (logger.getOutputMode() === 'human') {
        logger.info(`  Token type:  ${auth.tokenType}`);
        logger.info(`  Source:      ${auth.source}`);
        if (stored?.user_email) logger.info(`  Email:       ${stored.user_email}`);
        if (stored?.user_name) logger.info(`  User:        ${stored.user_name}`);
        if (stored?.organisation_id) {
          logger.info(`  Org:         ${stored.organisation_name} (ID: ${stored.organisation_id})`);
        } else {
          logger.info(`  Context:     Personal`);
        }
        if (stored?.expires_at) logger.info(`  Expires:     ${stored.expires_at}`);
        if (stored?.site_tokens) {
          logger.info(`  Sites:       ${Object.keys(stored.site_tokens).length} linked`);
        }
      }
    });
}
