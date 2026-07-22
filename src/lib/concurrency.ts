// Runs `fn` over `items` with at most `limit` in flight at once — lets a
// connection pool actually get used concurrently instead of every item
// waiting on the previous one's round-trip to finish, while keeping
// concurrency bounded instead of firing everything at once.
export async function mapLimit<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
}
