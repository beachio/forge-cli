import PusherImport from 'pusher-js';
import type { Channel } from 'pusher-js';
import type { DeployLogEvent, VersionUpdateEvent, SiteUpdateEvent } from './types.js';

// pusher-js is CJS; default ESM interop can yield the module namespace instead of
// the constructor, which surfaces as "Pusher is not a constructor" at runtime.
const Pusher = PusherImport.default ?? PusherImport;

export interface DeployEventHandlers {
  onLog: (event: DeployLogEvent) => void;
  onVersionUpdate: (event: VersionUpdateEvent) => void;
  onSiteUpdate: (event: SiteUpdateEvent) => void;
  onError?: (error: Error) => void;
}

interface BufferedEvent {
  name: 'log' | 'version_update' | 'site_update';
  data: unknown;
}

/**
 * Wraps pusher-js with an event-buffering strategy so the channel can be
 * subscribed *before* we know the version_id. Call `subscribe()` first,
 * then `attach(handlers)` once the deploy response arrives -- buffered
 * events are replayed in order through the handlers.
 */
export class ForgePusherClient {
  private pusher: Pusher;
  private channel: Channel | null = null;
  private channelName: string;
  private buffer: BufferedEvent[] = [];
  private handlers: DeployEventHandlers | null = null;

  constructor(pusherKey: string, channelName: string) {
    this.channelName = channelName;
    Pusher.logToConsole = false;

    this.pusher = new Pusher(pusherKey, {
      cluster: 'mt1',
      forceTLS: true,
    });
  }

  subscribe(): void {
    this.channel = this.pusher.subscribe(this.channelName);

    this.channel.bind('log', (data: DeployLogEvent) => {
      if (this.handlers) {
        this.handlers.onLog(data);
      } else {
        this.buffer.push({ name: 'log', data });
      }
    });

    this.channel.bind('version_update', (data: VersionUpdateEvent) => {
      if (this.handlers) {
        this.handlers.onVersionUpdate(data);
      } else {
        this.buffer.push({ name: 'version_update', data });
      }
    });

    this.channel.bind('site_update', (data: SiteUpdateEvent) => {
      if (this.handlers) {
        this.handlers.onSiteUpdate(data);
      } else {
        this.buffer.push({ name: 'site_update', data });
      }
    });

    this.pusher.connection.bind('error', (err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      if (this.handlers) {
        this.handlers.onError?.(error);
      }
    });
  }

  /**
   * Flush the event buffer through `handlers` and use them for all
   * subsequent events. Call this once the deploy response gives us
   * enough context (version_id) to process events meaningfully.
   */
  attach(handlers: DeployEventHandlers): void {
    this.handlers = handlers;

    for (const { name, data } of this.buffer) {
      switch (name) {
        case 'log':
          handlers.onLog(data as DeployLogEvent);
          break;
        case 'version_update':
          handlers.onVersionUpdate(data as VersionUpdateEvent);
          break;
        case 'site_update':
          handlers.onSiteUpdate(data as SiteUpdateEvent);
          break;
      }
    }
    this.buffer = [];
  }

  disconnect(): void {
    if (this.channel) {
      this.channel.unbind_all();
      this.pusher.unsubscribe(this.channelName);
      this.channel = null;
    }
    this.pusher.disconnect();
  }
}
