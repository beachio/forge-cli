import { Command } from 'commander';
import { getApiClient } from '../api/client.js';
import { API_PATHS } from '../config/constants.js';
import { resolveSiteTokenWithFallback } from '../auth/resolver.js';
import { ORG_OPTION_DESCRIPTION, validateOrgOption } from '../auth/org-context.js';
import * as logger from '../utils/logger.js';
import { handleCommandResult } from '../utils/output.js';

interface UsageResponse {
  usage: {
    site_id: number;
    url: string;
    bandwidth: {
      today: number;
      this_week: number;
      this_month: number;
      last_30_days: number;
    };
    build_minutes: {
      this_month: number;
      last_30_days: number;
    };
    previous_months: Array<{
      month: string;
      bandwidth: number;
      build_minutes: number;
    }>;
    daily: Array<{
      date: string;
      bytes: number;
      build_minutes: number;
    }>;
  };
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function registerUsageCommand(program: Command): void {
  program
    .command('usage')
    .description('Show bandwidth and build usage for a site')
    .option('-s, --site <site>', 'Site name')
    .option('--days <n>', 'Days of daily breakdown (default: 30, max: 365)')
    .option('--org <id>', ORG_OPTION_DESCRIPTION)
    .action(async (options, cmd) => {
      const parentOpts = cmd.parent?.opts() || {};
      validateOrgOption(options.org);
      const siteToken = await resolveSiteTokenWithFallback({
        siteToken: parentOpts.siteToken,
        token: parentOpts.token,
        site: options.site,
        organisationId: options.org,
      });

      const spin = logger.spinner('Fetching usage data...');

      try {
        const client = getApiClient();
        const query: Record<string, string> = { site_token: siteToken };
        if (options.days) query.days = options.days;

        const response = await client.get<UsageResponse>(API_PATHS.usage, { query });

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() !== 'human') return;

        const { usage } = response;
        const bw = usage.bandwidth;
        const bm = usage.build_minutes;

        logger.info('');
        logger.bold(`  Bandwidth for ${usage.url}`);
        logger.info('');
        logger.label('Today', formatBytes(bw.today));
        logger.label('This week', formatBytes(bw.this_week));
        logger.label('This month', formatBytes(bw.this_month));
        logger.label('Last 30 days', formatBytes(bw.last_30_days));

        logger.info('');
        logger.bold('  Build Minutes');
        logger.info('');
        logger.label('This month', `${bm.this_month} min`);
        logger.label('Last 30 days', `${bm.last_30_days} min`);

        if (usage.previous_months?.length) {
          logger.info('');
          logger.bold('  Monthly History');
          logger.info('');
          logger.table(
            ['Month', 'Bandwidth', 'Build Min'],
            usage.previous_months.map((m) => [
              m.month,
              formatBytes(m.bandwidth),
              `${m.build_minutes} min`,
            ]),
          );
        }

        if (usage.daily?.length && options.days) {
          logger.info('');
          logger.bold('  Daily Breakdown');
          logger.info('');
          logger.table(
            ['Date', 'Bandwidth', 'Build Min'],
            usage.daily.map((d) => [
              d.date,
              formatBytes(d.bytes),
              `${d.build_minutes} min`,
            ]),
          );
        }

        logger.info('');
      } catch (err) {
        spin.stop();
        throw err;
      }
    });
}
