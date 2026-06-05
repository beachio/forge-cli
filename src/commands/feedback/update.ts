import { Command } from 'commander';
import { getApiClient } from '../../api/client.js';
import { API_PATHS } from '../../config/constants.js';
import { resolveAuth } from '../../auth/resolver.js';
import * as logger from '../../utils/logger.js';
import { handleCommandResult } from '../../utils/output.js';
import {
  resolveFeedbackSiteQuery,
  type FeedbackStatus,
  type FeedbackUpdateResponse,
} from './shared.js';

function registerFeedbackStatusCommand(
  parent: Command,
  command: string,
  status: FeedbackStatus,
  description: string,
): void {
  parent
    .command(command)
    .description(description)
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

      const spin = logger.spinner(`Updating feedback #${id}...`);

      try {
        const client = getApiClient();
        const response = await client.request<FeedbackUpdateResponse>(
          `${API_PATHS.feedbacks}/${id}`,
          {
            method: 'PATCH',
            token: auth.token,
            query: siteQuery,
            body: { site_feedback: { status } },
          },
        );

        spin.stop();
        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          logger.success(`Feedback #${id} marked as ${status}.`);
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}

export function registerFeedbackUpdateCommands(parent: Command): void {
  registerFeedbackStatusCommand(
    parent,
    'resolve',
    'resolved',
    'Mark feedback as resolved after a fix is shipped',
  );
  registerFeedbackStatusCommand(
    parent,
    'dismiss',
    'dismissed',
    'Dismiss feedback without action',
  );
}
