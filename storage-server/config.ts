export interface StorageConfig {
  port: number;
  dataDir: string;
  selfAddress: string;
  // Naming server to register with. Empty string disables registration
  // (useful for running a storage server standalone in tests).
  namingServerUrl: string;
  heartbeatSeconds: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): StorageConfig {
  const port = parseInt(env.PORT ?? '8001', 10);
  return {
    port,
    dataDir: env.DATA_DIR ?? './data',
    // Address other containers reach this server on (e.g. "storage1:8001").
    selfAddress: env.SELF_ADDRESS ?? `localhost:${port}`,
    namingServerUrl: env.NAMING_SERVER_URL ?? 'http://naming-server:8000',
    heartbeatSeconds: parseInt(env.HEARTBEAT_SECONDS ?? '15', 10),
  };
}
