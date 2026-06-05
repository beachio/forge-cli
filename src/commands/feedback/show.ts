import { Command } from 'commander';
import { getApiClient } from '../../api/client.js';
import { API_PATHS } from '../../config/constants.js';
import { resolveAuth } from '../../auth/resolver.js';
import * as logger from '../../utils/logger.js';
import { handleCommandResult } from '../../utils/output.js';
import {
  resolveFeedbackSiteQuery,
  feedbackStatusBadge,
  type FeedbackShowResponse,
  type SiteFeedback,
} from './shared.js';

export function registerFeedbackShowCommand(parent: Command): void {
  parent
    .command('show')
    .description('Show full details for a feedback item')
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

      const spin = logger.spinner(`Fetching feedback #${id}...`);

      try {
        const client = getApiClient();
        const response = await client.get<FeedbackShowResponse>(
          `${API_PATHS.feedbacks}/${id}`,
          {
            token: auth.token,
            query: siteQuery,
          },
        );

        spin.stop();
        handleCommandResult(response);

        if (logger.getOutputMode() !== 'human') return;

        renderFeedbackDetail(response.site_feedback);
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}

function renderFeedbackDetail(item: SiteFeedback): void {
  logger.info('');
  logger.bold(`  Feedback #${item.id}`);
  logger.info('');

  logger.label('Status', logger.statusBadge(feedbackStatusBadge(item.status)));
  logger.label('Type', item.feedback_type);
  if (item.page_url) logger.label('Page', item.page_url);
  if (item.page_title) logger.label('Title', item.page_title);
  if (item.comment) logger.label('Comment', item.comment);

  if (item.feedback_type === 'element') {
    if (item.selector) logger.label('Selector', item.selector);
    if (item.element_summary) logger.label('Element', item.element_summary);
  } else if (item.selected_text) {
    logger.label('Selected Text', item.selected_text);
  }

  if (item.screenshot_url) logger.label('Screenshot', item.screenshot_url);

  if (item.author_name || item.author_email) {
    const author = [item.author_name, item.author_email].filter(Boolean).join(' <') +
      (item.author_email && item.author_name ? '>' : '');
    logger.label('Author', author);
  }

  if (item.device_type || item.browser_name) {
    const client = [
      item.device_type,
      item.browser_name && item.browser_version
        ? `${item.browser_name} ${item.browser_version}`
        : item.browser_name,
      item.os_name && item.os_version ? `${item.os_name} ${item.os_version}` : item.os_name,
    ]
      .filter(Boolean)
      .join(' · ');
    logger.label('Client', client);
  }

  if (item.viewport_width && item.viewport_height) {
    logger.label('Viewport', `${item.viewport_width}×${item.viewport_height}`);
  }

  if (item.version_id != null) logger.label('Version ID', String(item.version_id));
  logger.label('Created', new Date(item.created_at).toLocaleString());
  if (item.updated_at !== item.created_at) {
    logger.label('Updated', new Date(item.updated_at).toLocaleString());
  }

  logger.info('');
}
