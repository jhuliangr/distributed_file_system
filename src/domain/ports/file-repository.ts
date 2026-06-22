import type { StoredFile } from '../entities.ts';

export interface FileRepository {
  exists(name: string): Promise<boolean>;
  save(file: StoredFile): Promise<void>;
  findByName(name: string): Promise<StoredFile | null>;
  getSize(name: string): Promise<number | null>;
  /** Delete and return the file as it was, or null if it did not exist. */
  delete(name: string): Promise<StoredFile | null>;
}
