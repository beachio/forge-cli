export interface RetryOptions {
  maxRetries?: number;
  onRetry?: (attempt: number, waitMs: number) => void;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {},
): Promise<T> {
  const { maxRetries = 3, onRetry } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;

      if (attempt >= maxRetries) break;

      if (isRetryableError(err)) {
        const retryAfter = getRetryAfterMs(err);
        const waitMs = retryAfter || Math.min(1000 * Math.pow(2, attempt), 30_000);
        onRetry?.(attempt + 1, waitMs);
        await sleep(waitMs);
        continue;
      }

      throw err;
    }
  }

  throw lastError;
}

function isRetryableError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: number }).status;
    return status === 429 || status >= 500;
  }
  return false;
}

function getRetryAfterMs(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'retryAfterSeconds' in err) {
    return (err as { retryAfterSeconds: number }).retryAfterSeconds * 1000;
  }
  return undefined;
}
