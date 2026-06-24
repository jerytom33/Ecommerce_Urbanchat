/**
 * E-commerce Platform API Server (Fastify)
 * Entry point for the unified backend API.
 */
import { buildServer } from './server.js';
import { config } from './config.js';

async function main(): Promise<void> {
  const server = await buildServer({ logger: true });

  // Graceful shutdown handlers
  const signals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  for (const signal of signals) {
    process.on(signal, async () => {
      server.log.info(`Received ${signal}, shutting down gracefully...`);
      await server.close();
      process.exit(0);
    });
  }

  try {
    await server.listen({ port: config.port, host: config.host });
    server.log.info(`API server running at http://${config.host}:${config.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();
