export interface AppConfig {
  port: number;
  dbPath: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    port: parseInt(env.PORT ?? '8000', 10),
    dbPath: env.NAMING_DB_PATH ?? '/data/naming.db',
  };
}
