import { Command } from 'commander';
import { getApiClient } from '../../api/client.js';
import { API_PATHS } from '../../config/constants.js';
import { resolveAuth } from '../../auth/resolver.js';
import * as logger from '../../utils/logger.js';
import { handleCommandResult } from '../../utils/output.js';
import { resolveFeedbackSiteQuery } from './shared.js';

export function registerFeedbackDeleteCommand(parent: Command): void {
  parent
    .command('delete')
    .description('Permanently delete a feedback item')
    .argument('<id>', 'Feedback ID')
    .option('-s, --site <site>', 'Site ID, name, or token')
    .action(async (id: string, options, cmd) => {
      const parentOpts = cmd.parent?.parent?.opts() || {};
      const feedbackOpts = cmd.parent?.opts() || {};
      const auth = resolveAuth({ token: parentOpts.token });
      const siteQuery = await resolveFeedbackSiteQuery({
        site: options.site || feedbackOpts.site,
        siteToken: parentOpts.siteToken,
        token: parentOpts.token,
      });

      const spin = logger.spinner(`Deleting feedback #${id}...`);

      try {
        const client = getApiClient();
        await client.delete(`${API_PATHS.feedbacks}/${id}`, {
          token: auth.token,
          query: siteQuery,
        });

        spin.stop();
        handleCommandResult({ deleted: true, id: Number(id) });

        if (logger.getOutputMode() === 'human') {
          logger.success(`Feedback #${id} deleted.`);
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
