import { Router } from 'express';
import type { StorageService } from '../../application/storage-service.ts';
import { asyncHandler } from './async-handler.ts';
import { parseAddress } from './validators.ts';
import { toStorageServerDto } from './dto.ts';

export function storageRouter(service: StorageService): Router {
  const router = Router();

  router.post(
    '/storage/register',
    asyncHandler(async (req, res) => {
      const address = parseAddress(req.body);
      await service.register(address);
      res.status(200).json({ status: 'registered', address });
    }),
  );

  router.get(
    '/storage',
    asyncHandler(async (req, res) => {
      const all = req.query.all;
      const onlyAlive = !(all === '1' || all === 'true' || all === 'yes');
      const servers = await service.listServers(onlyAlive);
      res.json({ servers: servers.map(toStorageServerDto) });
    }),
  );

  router.post(
    '/storage/:address/status',
    asyncHandler(async (req, res) => {
      const alive = Boolean((req.body ?? {}).alive ?? true);
      await service.setStatus(req.params.address, alive);
      res.status(200).json({ address: req.params.address, alive });
    }),
  );

  return router;
}
