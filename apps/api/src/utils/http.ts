export interface FetchOptions extends RequestInit {
  timeoutMs?: number;
}

export async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeoutMs = 15000, ...fetchOptions } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(`Timeout of ${timeoutMs}ms exceeded`), timeoutMs);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: options.signal ? (options.signal as AbortSignal) : controller.signal,
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}
