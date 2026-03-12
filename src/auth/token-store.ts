import Conf from 'conf';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { CREDENTIALS_DIR, CREDENTIALS_FILE } from '../config/constants.js';

export interface StoredCredentials {
  token: string;
  token_type: 'cli' | 'site';
  user_email?: string;
  user_name?: string;
  site_tokens?: Record<string, string>;
  expires_at?: string;
  pusher_key?: string;
  pusher_channel?: string;
  organisation_id?: number | null;
  organisation_name?: string | null;
}

const store = new Conf<{ credentials?: StoredCredentials }>({
  projectName: CREDENTIALS_DIR,
  configName: CREDENTIALS_FILE,
  cwd: join(homedir(), CREDENTIALS_DIR),
  encryptionKey: 'forge-cli-v2',
});

export function getStoredCredentials(): StoredCredentials | undefined {
  return store.get('credentials');
}

export function storeCredentials(credentials: StoredCredentials): void {
  store.set('credentials', credentials);
}

export function clearCredentials(): void {
  store.delete('credentials');
}

export function hasStoredCredentials(): boolean {
  return store.has('credentials');
}
