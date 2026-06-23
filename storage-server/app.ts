import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
} from 'express';
import { ChunkStore, InvalidChunkIdError } from './chunk-store.ts';
import { asyncHandler } from './async-handler.ts';

export interface AppDependencies {
  store: ChunkStore;
  selfAddress: string;
}

export function createApp(deps: AppDependencies): Express {
  const { store, selfAddress } = deps;
  const app = express();

  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', service: 'storage-server', address: selfAddress });
  });

  // PUT /chunks/:chunkId — store raw chunk bytes on disk.
  app.put(
    '/chunks/:chunkId',
    express.raw({ type: () => true, limit: '16mb' }),
    asyncHandler(async (req: Request, res: Response) => {
      const data = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      await store.put(req.params.chunkId, data);
      res
        .status(201)
        .json({ status: 'stored', chunk_id: req.params.chunkId, size: data.length });
    }),
  );

  // GET /chunks/:chunkId — return the raw chunk bytes.
  app.get(
    '/chunks/:chunkId',
    asyncHandler(async (req: Request, res: Response) => {
      const data = await store.get(req.params.chunkId);
      if (data === null) {
        res.status(404).json({ error: 'chunk not found', chunk_id: req.params.chunkId });
        return;
      }
      res.type('application/octet-stream').send(data);
    }),
  );

  // DELETE /chunks/:chunkId — remove the chunk (idempotent).
  app.delete(
    '/chunks/:chunkId',
    asyncHandler(async (req: Request, res: Response) => {
      const existed = await store.delete(req.params.chunkId);
      res.json({ status: 'deleted', chunk_id: req.params.chunkId, existed });
    }),
  );

  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
      if (err instanceof InvalidChunkIdError) {
        res.status(400).json({ error: err.message });
        return;
      }
      console.error('unhandled error:', err);
      res.status(500).json({ error: 'internal server error' });
    },
  );

  return app;
}
