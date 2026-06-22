import { Router } from 'express';
import type { FileService } from '../../application/file-service.ts';
import { asyncHandler } from './async-handler.ts';
import { parseCreateFileCommand } from './validators.ts';
import { toFileDto, toChunkDto } from './dto.ts';

export function fileRouter(service: FileService): Router {
  const router = Router();

  router.post(
    '/files',
    asyncHandler(async (req, res) => {
      const command = parseCreateFileCommand(req.body);
      const file = await service.createFile(command);
      res.status(201).json({
        status: 'created',
        name: file.name,
        num_chunks: file.chunks.length,
      });
    }),
  );

  router.get(
    '/files/:name/size',
    asyncHandler(async (req, res) => {
      const size = await service.getSize(req.params.name);
      res.json({ name: req.params.name, size });
    }),
  );

  router.get(
    '/files/:name',
    asyncHandler(async (req, res) => {
      const file = await service.getFile(req.params.name);
      res.json(toFileDto(file));
    }),
  );

  router.delete(
    '/files/:name',
    asyncHandler(async (req, res) => {
      const file = await service.deleteFile(req.params.name);
      res.json({
        status: 'deleted',
        name: file.name,
        chunks: file.chunks.map(toChunkDto),
      });
    }),
  );

  return router;
}
