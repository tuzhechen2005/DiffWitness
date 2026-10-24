export function retryCount(options: { retries: number | null }): number {
  return options.retries ?? 3;
}
