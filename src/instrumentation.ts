export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const g = globalThis as typeof globalThis & {
    __cryptoBgSyncStarted?: boolean;
  };
  if (g.__cryptoBgSyncStarted) return;
  g.__cryptoBgSyncStarted = true;

  const { runBackgroundSync } = await import("./lib/sync");
  const { BG_TICK_MS } = await import("./lib/sync-config");

  const tick = async () => {
    try {
      await runBackgroundSync();
    } catch (err) {
      console.error("[instrumentation] background sync failed", err);
    }
  };

  // Initial delay so boot is not blocked by Binance
  setTimeout(() => {
    void tick();
    setInterval(() => {
      void tick();
    }, BG_TICK_MS);
  }, 5_000);
}
