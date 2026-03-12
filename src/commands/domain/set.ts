import { Command } from 'commander';
import { getApiClient } from '../../api/client.js';
import { API_PATHS } from '../../config/constants.js';
import { resolveAuth } from '../../auth/resolver.js';
import * as logger from '../../utils/logger.js';
import { handleCommandResult } from '../../utils/output.js';
import { displayDnsInstructions, type DnsInstructions } from '../../utils/dns-instructions.js';
import { ValidationError } from '../../utils/errors.js';

interface DomainSetResponse {
  site: {
    id: number;
    url: string;
    previous_url: string;
    site_token: string;
    ssl: boolean;
    ssl_note: string;
  };
}

interface DomainSetErrorData {
  error: string;
  dns_valid: boolean;
  instructions?: DnsInstructions;
}

export function registerDomainSetCommand(domain: Command): void {
  domain
    .command('set')
    .description('Assign a custom domain to a Forge site')
    .requiredOption('--site-token <token>', 'Site token for the target site')
    .requiredOption('--domain <domain>', 'Custom domain to assign (e.g. mysite.com)')
    .action(async (options, cmd) => {
      const rootOpts = cmd.parent?.parent?.opts() || {};
      const auth = resolveAuth({ token: rootOpts.token });

      const spin = logger.spinner(`Setting domain ${options.domain}...`);

      try {
        const client = getApiClient();
        const response = await client.post<DomainSetResponse>(API_PATHS.domainSet, {
          token: auth.token,
          body: {
            site_token: options.siteToken,
            domain: options.domain,
          },
        });

        spin.stop();

        handleCommandResult(response);

        if (logger.getOutputMode() === 'human') {
          const { site } = response;
          logger.success(`Domain updated: ${site.previous_url} → ${site.url}`);
          logger.info('');
          logger.dim(`  SSL: ${site.ssl_note}`);
        }
      } catch (err) {
        spin.stop();

        if (err instanceof ValidationError) {
          const details = err.details as unknown as DomainSetErrorData;
          if (details?.dns_valid === false && details.instructions) {
            handleCommandResult(details);
            if (logger.getOutputMode() === 'human') {
              logger.error(err.message);
              displayDnsInstructions(options.domain, details.instructions);
            }
            process.exit(1);
          }
        }

        throw err;
      }
    });
}
