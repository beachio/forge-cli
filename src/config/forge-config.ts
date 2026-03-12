import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_CONFIG_FILE } from './constants.js';

export interface ForgeConfig {
  site?: string;
  site_token?: string;
  ignore?: string[];
  compiler?: string;
  deploy_directory?: string;
}

export function getConfigPath(dir?: string): string {
  return join(dir || process.cwd(), PROJECT_CONFIG_FILE);
}

export function readForgeConfig(dir?: string): ForgeConfig | undefined {
  const configPath = getConfigPath(dir);
  if (!existsSync(configPath)) return undefined;

  try {
    const content = readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as ForgeConfig;
  } catch {
    return undefined;
  }
}

export function writeForgeConfig(config: ForgeConfig, dir?: string): void {
  const configPath = getConfigPath(dir);
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function hasForgeConfig(dir?: string): boolean {
  return existsSync(getConfigPath(dir));
}
