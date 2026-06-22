import type { StorageServer } from '../domain/entities.ts';
import type { Clock } from '../domain/ports/clock.ts';
import type { StorageRepository } from '../domain/ports/storage-repository.ts';

export class StorageService {
  private readonly storage: StorageRepository;
  private readonly clock: Clock;

  constructor(storage: StorageRepository, clock: Clock) {
    this.storage = storage;
    this.clock = clock;
  }

  async register(address: string): Promise<void> {
    await this.storage.register(address, this.clock.now());
  }

  async listServers(onlyAlive: boolean): Promise<StorageServer[]> {
    return this.storage.list(onlyAlive);
  }

  async setStatus(address: string, alive: boolean): Promise<void> {
    await this.storage.setAlive(address, alive, this.clock.now());
  }
}
