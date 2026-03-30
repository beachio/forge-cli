import { API_BASE_URL, USER_AGENT } from '../config/constants.js';
import {
  AuthError,
  ScopeError,
  RateLimitError,
  ValidationError,
  PlanLimitError,
  AccountLockedError,
  ForgeError,
} from '../utils/errors.js';
import type { ApiErrorResponse } from './endpoints.js';

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'DELETE' | 'PUT' | 'PATCH';
  headers?: Record<string, string>;
  body?: Record<string, unknown> | FormData;
  token?: string;
  siteToken?: string;
  query?: Record<string, string>;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  async request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', headers = {}, body, token, siteToken, query } = options;

    const url = new URL(path, this.baseUrl);
    if (query) {
      for (const [key, value] of Object.entries(query)) {
        url.searchParams.set(key, value);
      }
    }

    if (token && method === 'GET') {
      url.searchParams.set('token', token);
    }

    const requestHeaders: Record<string, string> = {
      Accept: 'application/json',
      'User-Agent': USER_AGENT,
      ...headers,
    };

    if (token) {
      requestHeaders['X-USER-TOKEN'] = token;
    }

    let requestBody: string | FormData | undefined;

    if (body instanceof FormData) {
      requestBody = body;
    } else if (body) {
      requestHeaders['Content-Type'] = 'application/json';
      const bodyWithAuth: Record<string, unknown> = { ...body };
      if (token) bodyWithAuth.token = token;
      if (siteToken) bodyWithAuth.site_token = siteToken;
      requestBody = JSON.stringify(bodyWithAuth);
    } else if (token && method !== 'GET') {
      requestHeaders['Content-Type'] = 'application/json';
      const bodyWithAuth: Record<string, unknown> = { token };
      if (siteToken) bodyWithAuth.site_token = siteToken;
      requestBody = JSON.stringify(bodyWithAuth);
    } else if (siteToken) {
      requestHeaders['Content-Type'] = 'application/json';
      requestBody = JSON.stringify({ site_token: siteToken });
    }

    if (isHttpDebugEnabled()) {
      debugHttpRequest(method, url.toString(), requestHeaders, requestBody);
    }

    const response = await fetch(url.toString(), {
      method,
      headers: requestHeaders,
      body: requestBody,
    });

    const responseText = await response.text();

    if (isHttpDebugEnabled()) {
      debugHttpResponse(response, responseText);
    }

    if (!response.ok) {
      await this.handleErrorResponse(response, responseText);
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json') && responseText.length > 0) {
      return JSON.parse(responseText) as T;
    }

    if (responseText.length === 0) {
      return {} as T;
    }

    return responseText as unknown as T;
  }

  async get<T>(path: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'GET' });
  }

  async post<T>(path: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'POST' });
  }

  async delete<T>(path: string, options: Omit<RequestOptions, 'method'> = {}): Promise<T> {
    return this.request<T>(path, { ...options, method: 'DELETE' });
  }

  private async handleErrorResponse(response: Response, responseText?: string): Promise<never> {
    let errorData: ApiErrorResponse | undefined;

    try {
      const rawText = responseText ?? (await response.text());
      errorData = JSON.parse(rawText) as ApiErrorResponse;
    } catch {
      const fallback = responseText?.trim();
      if (fallback) {
        throw new ForgeError(`HTTP ${response.status}: ${fallback}`);
      }
      throw new ForgeError(`HTTP ${response.status}: ${response.statusText}`);
    }

    const message = errorData?.error || errorData?.message || response.statusText;

    switch (response.status) {
      case 401: {
        const tokenExpired = errorData?.token_expired === true;
        throw new AuthError(
          tokenExpired
            ? 'Token has expired. Run `forge login` to re-authenticate.'
            : message,
          tokenExpired,
        );
      }

      case 403: {
        if (errorData?.required_scope && errorData?.token_scopes) {
          throw new ScopeError(errorData.required_scope, errorData.token_scopes);
        }
        if (errorData?.locked) {
          throw new AccountLockedError(errorData.retry_after_seconds || 1800);
        }
        throw new PlanLimitError(message);
      }

      case 404:
        throw new ForgeError(`Not found: ${message}`);

      case 422:
        throw new ValidationError(message, errorData as unknown as Record<string, unknown>);

      case 429: {
        const retryAfter =
          errorData?.retry_after_seconds ||
          parseInt(response.headers.get('Retry-After') || '60', 10);
        throw new RateLimitError(message, retryAfter);
      }

      default:
        throw new ForgeError(`HTTP ${response.status}: ${message}`);
    }
  }
}

function isHttpDebugEnabled(): boolean {
  const value = process.env.FORGE_DEBUG_HTTP?.trim().toLowerCase();
  return value === '1' || value === 'true' || value === 'yes' || value === 'on';
}

function debugHttpResponse(response: Response, responseText: string): void {
  const headers = Object.fromEntries(response.headers.entries());
  const payload = [
    '[forge:debug:http] RESPONSE',
    `status: ${response.status} ${response.statusText}`,
    `headers: ${safeStringify(headers)}`,
    `body: ${formatDebugBody(responseText)}`,
  ].join('\n');
  process.stderr.write(`${payload}\n`);
}

function debugHttpRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  body: string | FormData | undefined,
): void {
  const payload = [
    '[forge:debug:http] REQUEST',
    `method: ${method}`,
    `url: ${url}`,
    `headers: ${safeStringify(headers)}`,
    `body: ${formatRequestBody(body)}`,
  ].join('\n');
  process.stderr.write(`${payload}\n`);
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatDebugBody(value: string): string {
  if (!value) return '(empty)';
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

function formatRequestBody(body: string | FormData | undefined): string {
  if (!body) return '(none)';
  if (typeof body === 'string') {
    return formatDebugBody(body);
  }

  const entries: Array<{ key: string; value: unknown }> = [];
  for (const [key, value] of body.entries()) {
    if (typeof value === 'string') {
      entries.push({ key, value });
      continue;
    }

    entries.push({
      key,
      value: {
        type: value.type,
        size: value.size,
        ...(typeof (value as { name?: unknown }).name === 'string'
          ? { name: (value as { name: string }).name }
          : {}),
      },
    });
  }
  return safeStringify(entries);
}

let defaultClient: ApiClient | undefined;

export function getApiClient(): ApiClient {
  if (!defaultClient) {
    defaultClient = new ApiClient();
  }
  return defaultClient;
}
