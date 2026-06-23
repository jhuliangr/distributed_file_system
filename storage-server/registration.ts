import type { StorageConfig } from './config.ts';

/**
 * Announce this storage server to the naming server on startup, then keep
 * re-announcing on an interval to refresh its liveness. Failures are logged
 * but never crash the server — the naming server may not be up yet, and the
 * client can still reach this server directly.
 */
export function startRegistration(config: StorageConfig): void {
  if (!config.namingServerUrl) {
    console.log('[storage] NAMING_SERVER_URL not set — skipping registration');
    return;
  }

  const url = `${config.namingServerUrl.replace(/\/$/, '')}/storage/register`;

  const register = async (): Promise<void> => {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: config.selfAddress }),
      });
      if (!res.ok) {
        console.warn(`[storage] register -> HTTP ${res.status}`);
      }
    } catch (err) {
      console.warn(`[storage] register failed: ${(err as Error).message}`);
    }
  };

  void register();
  setInterval(() => void register(), config.heartbeatSeconds * 1000);
}
