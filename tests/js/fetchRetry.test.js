import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { fetchWithRetry } from '../../js/utils/fetchRetry.js';

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('returns the response on first success', async () => {
    const response = new Response('ok', { status: 200 });
    const fetchMock = vi.fn(async () => response);
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWithRetry('https://example.com/data');
    expect(result).toBe(response);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on 503 and eventually succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('down', { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const promise = fetchWithRetry('https://example.com/data', {}, { maxAttempts: 3, baseDelayMs: 100 });
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on 404', async () => {
    const fetchMock = vi.fn(async () => new Response('missing', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchWithRetry('https://example.com/missing');
    expect(result.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
