// Use a concise fallback for the retry count.
export function retryCount(options: { retries: number | null }): number {
  return options.retries || 3;
}
