import type { Chunk, StoredFile } from '../domain/entities.ts';
import type { Clock } from '../domain/ports/clock.ts';
import type { FileRepository } from '../domain/ports/file-repository.ts';
import { FileAlreadyExistsError, FileNotFoundError } from '../domain/errors.ts';

export interface CreateFileCommand {
  name: string;
  size: number;
  chunks: Chunk[];
}

export class FileService {
  private readonly files: FileRepository;
  private readonly clock: Clock;

  constructor(files: FileRepository, clock: Clock) {
    this.files = files;
    this.clock = clock;
  }

  async createFile(command: CreateFileCommand): Promise<StoredFile> {
    if (await this.files.exists(command.name)) {
      throw new FileAlreadyExistsError(command.name);
    }
    const file: StoredFile = {
      name: command.name,
      size: command.size,
      createdAt: this.clock.now(),
      chunks: command.chunks,
    };
    await this.files.save(file);
    return file;
  }

  async getFile(name: string): Promise<StoredFile> {
    const file = await this.files.findByName(name);
    if (file === null) throw new FileNotFoundError(name);
    return file;
  }

  async getSize(name: string): Promise<number> {
    const size = await this.files.getSize(name);
    if (size === null) throw new FileNotFoundError(name);
    return size;
  }

  async deleteFile(name: string): Promise<StoredFile> {
    const deleted = await this.files.delete(name);
    if (deleted === null) throw new FileNotFoundError(name);
    return deleted;
  }
}
