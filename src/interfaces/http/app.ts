import express, { type Express, type Request, type Response } from 'express';
import type { FileService } from '../../application/file-service.ts';
import type { StorageService } from '../../application/storage-service.ts';
import { fileRouter } from './file-controller.ts';
import { storageRouter } from './storage-controller.ts';
import { errorHandler } from './error-handler.ts';

export interface HttpDependencies {
  fileService: FileService;
  storageService: StorageService;
}

export function createApp(deps: HttpDependencies): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'naming-server' });
  });

  app.use(storageRouter(deps.storageService));
  app.use(fileRouter(deps.fileService));

  app.use(errorHandler);
  return app;
}
