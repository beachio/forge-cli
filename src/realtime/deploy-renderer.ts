import chalk from 'chalk';
import type { DeployLogEvent, VersionUpdateEvent, SiteUpdateEvent } from './types.js';
import { getOutputMode } from '../utils/logger.js';

const PROGRESS_BAR_WIDTH = 20;

interface CollectedEvent {
  type: 'log' | 'version_update' | 'site_update';
  timestamp: string;
  data: DeployLogEvent | VersionUpdateEvent | SiteUpdateEvent;
}

export class DeployRenderer {
  private siteUrl: string;
  private versionId: number;
  private versionNumber: number;
  private lastPercentLine = false;
  private finalizingPrinted = false;
  private finalUrl: string | null = null;
  private collectedEvents: CollectedEvent[] = [];

  constructor(siteUrl: string, versionId: number, versionNumber: number) {
    this.siteUrl = siteUrl;
    this.versionId = versionId;
    this.versionNumber = versionNumber;
  }

  start(): void {
    const mode = getOutputMode();
    if (mode !== 'human') return;

    console.log(chalk.bold(`┌─ Deploying ${this.siteUrl}`));
    console.log('│');
    console.log(`├─ Uploading archive...              ${chalk.green('✔')}`);
    console.log(`├─ Version #${this.versionNumber} queued                 ${chalk.green('✔')}`);
    console.log('│');
  }

  handleLog(event: DeployLogEvent): void {
    this.collectedEvents.push({
      type: 'log',
      timestamp: new Date().toISOString(),
      data: event,
    });

    if (event.version_id !== this.versionId) return;

    const mode = getOutputMode();
    if (mode !== 'human') return;

    this.clearPercentLine();

    const time = event.time ? chalk.dim(event.time) : '';

    switch (event.status) {
      case 'start':
        console.log(`├─ ${event.message}                   ${time}`);
        break;
      case 'status':
        console.log(`├─ ${chalk.cyan(event.message)}  ${time}`);
        break;
      case 'ok':
        console.log(`├─ ${event.message}  ${time}  ${chalk.green('✔')}`);
        break;
      case 'warning':
        console.log(`├─ ${chalk.yellow(event.message)}  ${time}  ${chalk.yellow('⚠')}`);
        break;
      case 'fail':
        console.log(`├─ ${chalk.red(event.message)}  ${time}  ${chalk.red('✖')}`);
        break;
      case 'success':
        break;
      case 'redeploy':
        console.log(`├─ ${chalk.dim(event.message)}  ${time}`);
        break;
    }
  }

  handleVersionUpdate(event: VersionUpdateEvent): void {
    this.collectedEvents.push({
      type: 'version_update',
      timestamp: new Date().toISOString(),
      data: event,
    });

    if (event.version.id !== this.versionId) return;

    const mode = getOutputMode();
    if (mode !== 'human') return;

    const pct = event.version.percent_deployed;

    if (pct > 100) {
      if (!this.finalizingPrinted) {
        this.clearPercentLine();
        console.log(`├─ Finalizing...`);
        this.finalizingPrinted = true;
      }
      return;
    }

    const filled = Math.round((pct / 100) * PROGRESS_BAR_WIDTH);
    const empty = PROGRESS_BAR_WIDTH - filled;
    const bar = chalk.green('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
    const label = `${pct}%`.padStart(4);

    this.clearPercentLine();
    process.stdout.write(`├─ Uploading  ${bar}  ${label}`);
    this.lastPercentLine = true;
  }

  handleSiteUpdate(event: SiteUpdateEvent): void {
    this.collectedEvents.push({
      type: 'site_update',
      timestamp: new Date().toISOString(),
      data: event,
    });

    this.finalUrl = event.site.url;
  }

  finish(succeeded: boolean, failMessage?: string): void {
    const mode = getOutputMode();

    if (mode === 'json') {
      const json = {
        success: succeeded,
        site_url: this.finalUrl || this.siteUrl,
        version_id: this.versionId,
        version_number: this.versionNumber,
        events: this.collectedEvents,
      };
      console.log(JSON.stringify(json, null, 2));
      return;
    }

    if (mode !== 'human') return;

    this.clearPercentLine();
    console.log('│');

    if (succeeded) {
      const url = this.finalUrl || this.siteUrl;
      const displayUrl = url.startsWith('http') ? url : `https://${url}`;
      console.log(`└─ ${chalk.green('✔')} ${chalk.green.bold('Deployed successfully')}`);
      console.log(`   ${chalk.cyan(displayUrl)}`);
    } else {
      console.log(`└─ ${chalk.red('✖')} ${chalk.red.bold('Deploy failed')}`);
      if (failMessage) {
        console.log(`   ${failMessage}`);
      }
    }
  }

  private clearPercentLine(): void {
    if (this.lastPercentLine) {
      process.stdout.write('\r\x1b[K');
      this.lastPercentLine = false;
    }
  }
}
