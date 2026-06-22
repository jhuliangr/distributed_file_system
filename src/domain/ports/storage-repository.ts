import type { StorageServer } from '../entities.ts';

export interface StorageRepository {
  /** Register a server or refresh its liveness, stamping `lastSeen`. */
  register(address: string, lastSeen: string): Promise<void>;
  list(onlyAlive: boolean): Promise<StorageServer[]>;
  setAlive(address: string, alive: boolean, lastSeen: string): Promise<void>;
}
