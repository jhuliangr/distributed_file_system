import type { Request, Response, NextFunction } from 'express';
import {
  ValidationError,
  FileNotFoundError,
  FileAlreadyExistsError,
} from '../../domain/errors.ts';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof FileAlreadyExistsError) {
    res.status(409).json({ error: err.message });
    return;
  }
  if (err instanceof FileNotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }
  console.error('unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
}
