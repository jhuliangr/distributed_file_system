export class DomainError extends Error {}

export class ValidationError extends DomainError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class FileNotFoundError extends DomainError {
  readonly fileName: string;
  constructor(fileName: string) {
    super(`file '${fileName}' not found`);
    this.name = 'FileNotFoundError';
    this.fileName = fileName;
  }
}

export class FileAlreadyExistsError extends DomainError {
  readonly fileName: string;
  constructor(fileName: string) {
    super(`file '${fileName}' already exists`);
    this.name = 'FileAlreadyExistsError';
    this.fileName = fileName;
  }
}
