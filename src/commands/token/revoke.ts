import { Command } from 'commander';
import { getApiClient } from '../../api/client.js';
import { API_PATHS } from '../../config/constants.js';
import { resolveAuth } from '../../auth/resolver.js';
import * as logger from '../../utils/logger.js';
import { handleCommandResult } from '../../utils/output.js';

export function registerTokenRevokeCommand(parent: Command): void {
  parent
    .command('revoke <id>')
    .description('Revoke a CLI token')
    .action(async (id: string, _, cmd) => {
      const parentOpts = cmd.parent?.parent?.opts() || {};
      const auth = resolveAuth({ token: parentOpts.token });

      const spin = logger.spinner('Revoking token...');

      try {
        const client = getApiClient();
        await client.delete(`${API_PATHS.tokens}/${id}`, {
          token: auth.token,
        });

        spin.stop();
        handleCommandResult({ success: true, id }, `Token ${id} revoked.`);
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
