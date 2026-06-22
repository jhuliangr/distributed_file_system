import { SqliteConnection } from './infrastructure/sqlite/connection.ts';
import { SqliteFileRepository } from './infrastructure/sqlite/sqlite-file-repository.ts';
import { SqliteStorageRepository } from './infrastructure/sqlite/sqlite-storage-repository.ts';
import { SystemClock } from './infrastructure/system-clock.ts';
import { FileService } from './application/file-service.ts';
import { StorageService } from './application/storage-service.ts';
import type { Clock } from './domain/ports/clock.ts';

export interface Container {
  connection: SqliteConnection;
  fileService: FileService;
  storageService: StorageService;
}

export interface ContainerOptions {
  dbPath: string;
  clock?: Clock;
}

export function createContainer(options: ContainerOptions): Container {
  const connection = new SqliteConnection(options.dbPath);
  const clock = options.clock ?? new SystemClock();

  const fileRepository = new SqliteFileRepository(connection);
  const storageRepository = new SqliteStorageRepository(connection);

  return {
    connection,
    fileService: new FileService(fileRepository, clock),
    storageService: new StorageService(storageRepository, clock),
  };
}
