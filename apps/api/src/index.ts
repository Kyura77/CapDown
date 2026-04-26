import { buildServer } from './server.js';
import { loadConfig } from './config.js';

const config = loadConfig();
const app = await buildServer(config);

try {
  await app.listen({
    host: config.host,
    port: config.port,
  });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}

const closeGracefully = async (signal: string) => {
  app.log.info(`Received signal to terminate: ${signal}`);
  await app.close();
  process.exit(0);
};

process.on('SIGINT', () => closeGracefully('SIGINT'));
process.on('SIGTERM', () => closeGracefully('SIGTERM'));

