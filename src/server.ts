import { loadConfig } from './config.ts';
import { createContainer } from './container.ts';
import { createApp } from './interfaces/http/app.ts';

const config = loadConfig();
const container = createContainer({ dbPath: config.dbPath });
const app = createApp(container);

app.listen(config.port, '0.0.0.0', () => {
  console.log(`naming-server listening on :${config.port}`);
});
