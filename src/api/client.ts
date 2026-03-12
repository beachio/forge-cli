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

    const response = await fetch(url.toString(), {
      method,
      headers: requestHeaders,
      body: requestBody,
    });

    if (!response.ok) {
      await this.handleErrorResponse(response);
    }

    const text = await response.text();
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json') && text.length > 0) {
      return JSON.parse(text) as T;
    }

    if (text.length === 0) {
      return {} as T;
    }

    return text as unknown as T;
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

  private async handleErrorResponse(response: Response): Promise<never> {
    let errorData: ApiErrorResponse | undefined;

    try {
      errorData = (await response.json()) as ApiErrorResponse;
    } catch {
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

let defaultClient: ApiClient | undefined;

export function getApiClient(): ApiClient {
  if (!defaultClient) {
    defaultClient = new ApiClient();
  }
  return defaultClient;
}
