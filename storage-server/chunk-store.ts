import { promises as fs } from 'node:fs';
import path from 'node:path';

// Chunk ids are client-generated keys. Restrict them to safe characters so a
// crafted id (e.g. "../etc") can never escape the data directory.
const SAFE_CHUNK_ID = /^[A-Za-z0-9._-]+$/;

export class InvalidChunkIdError extends Error {
  constructor(chunkId: string) {
    super(`invalid chunk_id: ${JSON.stringify(chunkId)}`);
    this.name = 'InvalidChunkIdError';
  }
}

/**
 * Stores chunk bytes as plain files on disk, one file per chunk_id.
 * The naming server holds metadata only; the bytes live here.
 */
export class ChunkStore {
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  async init(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
  }

  private pathFor(chunkId: string): string {
    if (!SAFE_CHUNK_ID.test(chunkId)) {
      throw new InvalidChunkIdError(chunkId);
    }
    return path.join(this.dataDir, chunkId);
  }

  /** Write (or overwrite) a chunk. Overwriting the same id is idempotent. */
  async put(chunkId: string, data: Buffer): Promise<void> {
    await fs.writeFile(this.pathFor(chunkId), data);
  }

  /** Read a chunk, or null if it does not exist. */
  async get(chunkId: string): Promise<Buffer | null> {
    try {
      return await fs.readFile(this.pathFor(chunkId));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  /** Delete a chunk. Returns whether it existed (delete is idempotent). */
  async delete(chunkId: string): Promise<boolean> {
    try {
      await fs.unlink(this.pathFor(chunkId));
      return true;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return false;
      throw err;
    }
  }
}
