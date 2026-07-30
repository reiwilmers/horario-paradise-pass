const DEFAULT_RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function isRetryableError(error) {
  if (!error) return false;
  if (error.name === 'TypeError') return true;
  const status = Number(error.status || error.statusCode);
  return DEFAULT_RETRYABLE_STATUSES.has(status);
}

/**
 * Fetch with exponential backoff for transient network / server failures.
 */
export async function fetchWithRetry(url, options = {}, {
  maxAttempts = 3,
  baseDelayMs = 400,
  maxDelayMs = 4000,
  retryOn = isRetryableError,
} = {}) {
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url, options);
      if (!response.ok && DEFAULT_RETRYABLE_STATUSES.has(response.status) && attempt < maxAttempts) {
        const retryError = new Error(`HTTP ${response.status}`);
        retryError.status = response.status;
        throw retryError;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !retryOn(error)) {
        throw error;
      }
      const delay = Math.min(baseDelayMs * (2 ** (attempt - 1)), maxDelayMs);
      await sleep(delay);
    }
  }

  throw lastError;
}
