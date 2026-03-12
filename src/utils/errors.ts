import { EXIT_CODES } from '../config/constants.js';

export class ForgeError extends Error {
  readonly exitCode: number;

  constructor(message: string, exitCode: number = EXIT_CODES.ERROR) {
    super(message);
    this.name = 'ForgeError';
    this.exitCode = exitCode;
  }
}

export class AuthError extends ForgeError {
  readonly tokenExpired: boolean;

  constructor(message: string, tokenExpired = false) {
    super(message, EXIT_CODES.AUTH_FAILURE);
    this.name = 'AuthError';
    this.tokenExpired = tokenExpired;
  }
}

export class ScopeError extends ForgeError {
  readonly requiredScope: string;
  readonly tokenScopes: string[];

  constructor(requiredScope: string, tokenScopes: string[]) {
    const scopeList = tokenScopes.length ? tokenScopes.join(', ') : 'none';
    super(
      `Missing scope \`${requiredScope}\`. Your token has: \`${scopeList}\`. ` +
        `Create a new token with \`forge token create --scopes ${requiredScope}\`.`,
      EXIT_CODES.INSUFFICIENT_SCOPE,
    );
    this.name = 'ScopeError';
    this.requiredScope = requiredScope;
    this.tokenScopes = tokenScopes;
  }
}

export class RateLimitError extends ForgeError {
  readonly retryAfterSeconds: number;

  constructor(message: string, retryAfterSeconds: number) {
    super(message, EXIT_CODES.RATE_LIMITED);
    this.name = 'RateLimitError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ValidationError extends ForgeError {
  readonly details: Record<string, unknown>;

  constructor(message: string, details: Record<string, unknown> = {}) {
    super(message, EXIT_CODES.ERROR);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class PlanLimitError extends ForgeError {
  constructor(message: string) {
    super(message, EXIT_CODES.ERROR);
    this.name = 'PlanLimitError';
  }
}

export class AccountLockedError extends ForgeError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    const minutes = Math.ceil(retryAfterSeconds / 60);
    super(
      `Account locked due to too many failed login attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
      EXIT_CODES.AUTH_FAILURE,
    );
    this.name = 'AccountLockedError';
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
