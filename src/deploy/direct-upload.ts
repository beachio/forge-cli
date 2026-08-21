import { createReadStream, statSync } from 'node:fs';
import { Readable } from 'node:stream';
import { randomUUID } from 'node:crypto';
import type { ApiClient } from '../api/client.js';
import { API_PATHS } from '../config/constants.js';
import type {
  DeployCompleteResponse,
  DeployInitResponse,
  DeployResponse,
  DeployStatusResponse,
  DeployUploadTarget,
} from '../api/endpoints.js';
import { ApiError, ForgeError } from '../utils/errors.js';

export interface DirectDeployInitOptions {
  siteToken: string;
  archivePath: string;
  message?: string;
  cliToken?: string;
  idempotencyKey?: string;
}

export interface DirectDeployCompleteOptions {
  deployId: string;
  cliToken?: string;
}

export function isDirectUploadUnavailable(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 404 || error.status === 501 || error.status === 405;
  }
  return false;
}

export async function initDirectDeploy(
  client: ApiClient,
  options: DirectDeployInitOptions,
): Promise<DeployInitResponse> {
  const archiveSize = statSync(options.archivePath).size;

  return client.post<DeployInitResponse>(API_PATHS.deployInit, {
    token: options.cliToken,
    headers: {
      'Idempotency-Key': options.idempotencyKey ?? randomUUID(),
    },
    body: {
      site_tokens: options.siteToken,
      archive_size: archiveSize,
      ...(options.message ? { message: options.message } : {}),
    },
  });
}

export async function uploadArchiveToPresignedUrl(
  archivePath: string,
  upload: DeployUploadTarget,
): Promise<void> {
  const { size } = statSync(archivePath);
  const stream = Readable.toWeb(createReadStream(archivePath)) as ReadableStream<Uint8Array>;

  const headers: Record<string, string> = {
    'Content-Length': String(size),
    ...(upload.headers ?? {}),
  };

  if (!headers['Content-Type'] && !headers['content-type']) {
    headers['Content-Type'] = 'application/zip';
  }

  const response = await fetch(upload.url, {
    method: upload.method,
    headers,
    body: stream,
    duplex: 'half',
  } as RequestInit);

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new ForgeError(
      `Direct archive upload failed (HTTP ${response.status})${detail ? `: ${detail.trim()}` : ''}`,
    );
  }
}

export async function completeDirectDeploy(
  client: ApiClient,
  options: DirectDeployCompleteOptions,
): Promise<DeployCompleteResponse> {
  return client.post<DeployCompleteResponse>(`${API_PATHS.deployComplete}`, {
    token: options.cliToken,
    body: {
      deploy_id: options.deployId,
    },
  });
}

export async function getDirectDeployStatus(
  client: ApiClient,
  deployId: string,
  cliToken?: string,
): Promise<DeployStatusResponse> {
  return client.get<DeployStatusResponse>(`${API_PATHS.deployStatus}/${deployId}/status`, {
    token: cliToken,
  });
}

export async function deployViaLegacyMultipart(
  client: ApiClient,
  options: {
    siteToken: string;
    archivePath: string;
    message?: string;
    cliToken?: string;
  },
): Promise<DeployResponse> {
  const { readFileSync } = await import('node:fs');
  const archiveBuffer = readFileSync(options.archivePath);
  const formData = new FormData();
  formData.append('site_tokens', options.siteToken);
  if (options.message) {
    formData.append('message', options.message);
  }
  formData.append(
    'archive',
    new Blob([archiveBuffer], { type: 'application/zip' }),
    'deploy.zip',
  );

  return client.post<DeployResponse>(API_PATHS.deploy, {
    token: options.cliToken,
    body: formData as unknown as Record<string, unknown>,
  });
}
