import { Command } from 'commander';
import { getApiClient } from '../../api/client.js';
import { API_PATHS } from '../../config/constants.js';
import { resolveAuth } from '../../auth/resolver.js';
import * as logger from '../../utils/logger.js';
import { handleCommandResult } from '../../utils/output.js';
import type { TokenListItem } from '../../api/endpoints.js';

export function registerTokenListCommand(parent: Command): void {
  parent
    .command('list')
    .description('List active CLI tokens')
    .action(async (_, cmd) => {
      const parentOpts = cmd.parent?.parent?.opts() || {};
      const auth = resolveAuth({ token: parentOpts.token });

      const spin = logger.spinner('Fetching tokens...');

      try {
        const client = getApiClient();
        const raw = await client.get<TokenListItem[] | { tokens: TokenListItem[] }>(
          API_PATHS.tokens,
          { token: auth.token },
        );

        spin.stop();

        const tokens = Array.isArray(raw) ? raw : (raw.tokens || []);

        handleCommandResult(tokens);

        if (logger.getOutputMode() === 'human') {
          if (!tokens.length) {
            logger.info('No active tokens found.');
            return;
          }

          logger.table(
            ['ID', 'Name', 'Scopes', 'Expires', 'Last Used'],
            tokens.map((t) => {
              const scopes = t.scopes || [];
              return [
                String(t.id),
                t.name || '',
                scopes.length ? scopes.join(', ') : 'full access',
                t.expires_at ? new Date(t.expires_at).toLocaleDateString() : 'never',
                t.last_used_at ? new Date(t.last_used_at).toLocaleDateString() : 'never',
              ];
            }),
          );
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
