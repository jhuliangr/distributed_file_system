import type {
  Chunk,
  StoredFile,
  StorageServer,
} from '../../domain/entities.ts';

export interface ChunkDto {
  index: number;
  chunk_id: string;
  replicas: string[];
}

export interface FileDto {
  name: string;
  size: number;
  num_chunks: number;
  created_at: string;
  chunks: ChunkDto[];
}

export interface StorageServerDto {
  address: string;
  alive: number; // 1 | 0 — preserved from the original contract
  last_seen: string;
}

export function toChunkDto(chunk: Chunk): ChunkDto {
  return {
    index: chunk.index,
    chunk_id: chunk.chunkId,
    replicas: chunk.replicas,
  };
}

export function toFileDto(file: StoredFile): FileDto {
  return {
    name: file.name,
    size: file.size,
    num_chunks: file.chunks.length,
    created_at: file.createdAt,
    chunks: file.chunks.map(toChunkDto),
  };
}

export function toStorageServerDto(server: StorageServer): StorageServerDto {
  return {
    address: server.address,
    alive: server.alive ? 1 : 0,
    last_seen: server.lastSeen,
  };
}
