import { Command } from 'commander';
import { getApiClient } from '../../api/client.js';
import { API_PATHS } from '../../config/constants.js';
import { resolveAuth } from '../../auth/resolver.js';
import * as logger from '../../utils/logger.js';
import { handleCommandResult } from '../../utils/output.js';
import {
  resolveFeedbackSiteQuery,
  feedbackStatusBadge,
  type FeedbackListResponse,
  type FeedbackStatus,
  type FeedbackType,
} from './shared.js';

export function registerFeedbackListCommand(parent: Command): void {
  parent
    .command('list')
    .description('List site feedback for a staging or development site')
    .option('-s, --site <site>', 'Site ID, name, or token')
    .option('--status <status>', 'Filter by status (open, resolved, dismissed)')
    .option('--type <type>', 'Filter by type (element, text)')
    .option('--page <n>', 'Page number (default: 1)')
    .option('--per-page <n>', 'Results per page (default: 25, max: 100)')
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.parent?.opts() || {};
      const feedbackOpts = cmd.parent?.opts() || {};
      const auth = resolveAuth({ token: parentOpts.token });
      const siteQuery = await resolveFeedbackSiteQuery({
        site: options.site || feedbackOpts.site,
        siteToken: parentOpts.siteToken,
        token: parentOpts.token,
      });

      const query: Record<string, string> = { ...siteQuery };
      if (options.status) query.status = options.status as FeedbackStatus;
      if (options.type) query.feedback_type = options.type as FeedbackType;
      if (options.page) query.page = options.page;
      if (options.perPage) query.per_page = options.perPage;

      const spin = logger.spinner('Fetching feedback...');

      try {
        const client = getApiClient();
        const response = await client.get<FeedbackListResponse>(API_PATHS.feedbacks, {
          token: auth.token,
          query,
        });

        spin.stop();
        handleCommandResult(response);

        if (logger.getOutputMode() !== 'human') return;

        const { site_feedbacks: items, meta } = response;

        if (!items.length) {
          logger.info('No feedback found.');
          if (meta) {
            logger.dim(
              `  ${meta.site_url}: ${meta.open_count} open, ${meta.resolved_count} resolved, ${meta.dismissed_count} dismissed`,
            );
          }
          return;
        }

        logger.info('');
        if (meta) {
          logger.info(
            `  ${meta.site_url} — ${meta.open_count} open, ${meta.resolved_count} resolved, ${meta.dismissed_count} dismissed`,
          );
          logger.info('');
        }

        logger.table(
          ['ID', 'Status', 'Type', 'Comment', 'Page', 'Author', 'Created'],
          items.map((item) => [
            String(item.id),
            logger.statusBadge(feedbackStatusBadge(item.status)),
            item.feedback_type,
            truncate(item.comment, 40),
            truncate(item.page_url, 35),
            item.author_name || '-',
            new Date(item.created_at).toLocaleString(),
          ]),
        );

        if (meta && meta.total > meta.per_page) {
          logger.info('');
          const pages = Math.ceil(meta.total / meta.per_page);
          logger.dim(`  Page ${meta.page} of ${pages} (${meta.total} items)`);
        }
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
