import { loadConfig } from './config.ts';
import { ChunkStore } from './chunk-store.ts';
import { createApp } from './app.ts';
import { startRegistration } from './registration.ts';

const config = loadConfig();
const store = new ChunkStore(config.dataDir);
await store.init();

const app = createApp({ store, selfAddress: config.selfAddress });

app.listen(config.port, '0.0.0.0', () => {
  console.log(
    `storage-server listening on :${config.port} ` +
      `(address ${config.selfAddress}, data ${config.dataDir})`,
  );
  startRegistration(config);
});
