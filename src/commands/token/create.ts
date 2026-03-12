import { Command } from 'commander';
import { getApiClient } from '../../api/client.js';
import { API_PATHS } from '../../config/constants.js';
import { resolveAuth } from '../../auth/resolver.js';
import * as logger from '../../utils/logger.js';
import { handleCommandResult } from '../../utils/output.js';
import type { TokenCreateResponse } from '../../api/endpoints.js';

export function registerTokenCreateCommand(parent: Command): void {
  parent
    .command('create')
    .description('Create a new CLI token')
    .option('--name <name>', 'Human-readable label for the token')
    .option('--scopes <scopes>', 'Comma-separated permission scopes')
    .option('--site-ids <ids>', 'Comma-separated site IDs to restrict access')
    .option('--expires-in-days <days>', 'Days until token expires (default: 90)', '90')
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.parent?.opts() || {};
      const auth = resolveAuth({ token: parentOpts.token });

      const body: Record<string, unknown> = {};
      if (options.name) body.name = options.name;
      if (options.scopes) body.scopes = options.scopes.split(',').map((s: string) => s.trim());
      if (options.siteIds) {
        body.site_ids = options.siteIds.split(',').map((id: string) => parseInt(id.trim(), 10));
      }
      if (options.expiresInDays) body.expires_in_days = parseInt(options.expiresInDays, 10);

      const spin = logger.spinner('Creating token...');

      try {
        const client = getApiClient();
        const response = await client.post<TokenCreateResponse>(API_PATHS.tokens, {
          token: auth.token,
          body,
        });

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          const scopes = response.scopes || [];
          const siteIds = response.site_ids || [];

          logger.success('Token created successfully');
          logger.info('');
          logger.info(`  Token:     ${response.token}`);
          logger.info(`  ID:        ${response.id}`);
          logger.info(`  Name:      ${response.name}`);
          logger.info(`  Scopes:    ${scopes.length ? scopes.join(', ') : 'full access'}`);
          if (siteIds.length) {
            logger.info(`  Sites:     ${siteIds.join(', ')}`);
          }
          logger.info(`  Expires:   ${response.expires_at || 'never'}`);
          logger.info('');
          logger.warn('Store this token securely. It will not be shown again.');
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
