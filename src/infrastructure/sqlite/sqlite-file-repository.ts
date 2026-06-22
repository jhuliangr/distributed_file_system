import type { DatabaseSync } from 'node:sqlite';
import type { Chunk, StoredFile } from '../../domain/entities.ts';
import type { FileRepository } from '../../domain/ports/file-repository.ts';
import type { SqliteConnection } from './connection.ts';

interface FileRow {
  name: string;
  size: number;
  created_at: string;
}
interface ChunkRow {
  chunk_index: number;
  chunk_id: string;
}
interface ReplicaRow {
  storage_address: string;
}

export class SqliteFileRepository implements FileRepository {
  private readonly db: DatabaseSync;

  constructor(connection: SqliteConnection) {
    this.db = connection.db;
  }

  async exists(name: string): Promise<boolean> {
    return (
      this.db.prepare('SELECT 1 FROM files WHERE name = ?').get(name) !==
      undefined
    );
  }

  async save(file: StoredFile): Promise<void> {
    const insertFile = this.db.prepare(
      'INSERT INTO files (name, size, num_chunks, created_at) VALUES (?, ?, ?, ?)',
    );
    const insertChunk = this.db.prepare(
      'INSERT INTO chunks (file_name, chunk_index, chunk_id) VALUES (?, ?, ?)',
    );
    const insertReplica = this.db.prepare(
      'INSERT INTO chunk_replicas (file_name, chunk_id, storage_address) VALUES (?, ?, ?)',
    );

    this.db.exec('BEGIN');
    try {
      insertFile.run(file.name, file.size, file.chunks.length, file.createdAt);
      for (const chunk of file.chunks) {
        insertChunk.run(file.name, chunk.index, chunk.chunkId);
        for (const address of chunk.replicas) {
          insertReplica.run(file.name, chunk.chunkId, address);
        }
      }
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  async findByName(name: string): Promise<StoredFile | null> {
    const frow = this.db
      .prepare('SELECT name, size, created_at FROM files WHERE name = ?')
      .get(name) as FileRow | undefined;
    if (frow === undefined) return null;

    const chunkRows = this.db
      .prepare(
        'SELECT chunk_index, chunk_id FROM chunks WHERE file_name = ? ORDER BY chunk_index',
      )
      .all(name) as unknown as ChunkRow[];

    const replicaStmt = this.db.prepare(
      'SELECT storage_address FROM chunk_replicas WHERE chunk_id = ? ORDER BY storage_address',
    );

    const chunks: Chunk[] = chunkRows.map((c) => ({
      index: c.chunk_index,
      chunkId: c.chunk_id,
      replicas: (replicaStmt.all(c.chunk_id) as unknown as ReplicaRow[]).map(
        (r) => r.storage_address,
      ),
    }));

    return {
      name: frow.name,
      size: frow.size,
      createdAt: frow.created_at,
      chunks,
    };
  }

  async getSize(name: string): Promise<number | null> {
    const row = this.db
      .prepare('SELECT size FROM files WHERE name = ?')
      .get(name) as { size: number } | undefined;
    return row === undefined ? null : row.size;
  }

  async delete(name: string): Promise<StoredFile | null> {
    const existing = await this.findByName(name);
    if (existing === null) return null;
    this.db.prepare('DELETE FROM files WHERE name = ?').run(name); // cascades
    return existing;
  }
}
