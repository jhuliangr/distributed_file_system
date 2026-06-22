import { ValidationError } from '../../domain/errors.ts';
import type { Chunk } from '../../domain/entities.ts';
import type { CreateFileCommand } from '../../application/file-service.ts';

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function parseCreateFileCommand(body: unknown): CreateFileCommand {
  const { name, size, chunks } = asRecord(body);

  if (typeof name !== 'string' || name.length === 0) {
    throw new ValidationError('name (non-empty string) is required');
  }
  if (!Number.isInteger(size) || (size as number) < 0) {
    throw new ValidationError('size (non-negative integer) is required');
  }
  if (!Array.isArray(chunks) || chunks.length === 0) {
    throw new ValidationError('chunks (non-empty list) is required');
  }

  const seen = new Set<number>();
  const parsed: Chunk[] = chunks.map((raw) => {
    if (typeof raw !== 'object' || raw === null) {
      throw new ValidationError('each chunk must be an object');
    }
    const c = raw as Record<string, unknown>;
    if (typeof c.chunk_id !== 'string' || c.chunk_id.length === 0) {
      throw new ValidationError('each chunk needs a chunk_id');
    }
    if (!Number.isInteger(c.index)) {
      throw new ValidationError('each chunk needs an integer index');
    }
    if (!Array.isArray(c.replicas) || c.replicas.length === 0) {
      throw new ValidationError('each chunk needs a non-empty replicas list');
    }
    const index = c.index as number;
    if (seen.has(index))
      throw new ValidationError(`duplicate chunk index ${index}`);
    seen.add(index);
    return { index, chunkId: c.chunk_id, replicas: c.replicas as string[] };
  });

  return { name, size: size as number, chunks: parsed };
}

export function parseAddress(body: unknown): string {
  const { address } = asRecord(body);
  if (typeof address !== 'string' || address.length === 0) {
    throw new ValidationError('address is required');
  }
  return address;
}
