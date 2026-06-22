export interface Chunk {
  index: number; 
  chunkId: string; 
  replicas: string[];
}

export interface StoredFile {
  name: string;
  size: number; 
  createdAt: string;
  chunks: Chunk[];
}

export interface StorageServer {
  address: string; // "host:port" on the docker network
  alive: boolean;
  lastSeen: string;
}
