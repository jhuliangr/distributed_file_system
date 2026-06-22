import type { DatabaseSync } from 'node:sqlite';
import type { StorageServer } from '../../domain/entities.ts';
import type { StorageRepository } from '../../domain/ports/storage-repository.ts';
import type { SqliteConnection } from './connection.ts';

interface StorageRow {
  address: string;
  alive: number;
  last_seen: string;
}

export class SqliteStorageRepository implements StorageRepository {
  private readonly db: DatabaseSync;

  constructor(connection: SqliteConnection) {
    this.db = connection.db;
  }

  async register(address: string, lastSeen: string): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO storage_servers (address, alive, last_seen)
         VALUES (?, 1, ?)
         ON CONFLICT(address) DO UPDATE SET alive = 1, last_seen = excluded.last_seen`,
      )
      .run(address, lastSeen);
  }

  async list(onlyAlive: boolean): Promise<StorageServer[]> {
    let sql = 'SELECT address, alive, last_seen FROM storage_servers';
    if (onlyAlive) sql += ' WHERE alive = 1';
    sql += ' ORDER BY address';
    const rows = this.db.prepare(sql).all() as unknown as StorageRow[];
    return rows.map((r) => ({
      address: r.address,
      alive: r.alive === 1,
      lastSeen: r.last_seen,
    }));
  }

  async setAlive(
    address: string,
    alive: boolean,
    lastSeen: string,
  ): Promise<void> {
    this.db
      .prepare(
        'UPDATE storage_servers SET alive = ?, last_seen = ? WHERE address = ?',
      )
      .run(alive ? 1 : 0, lastSeen, address);
  }
}
