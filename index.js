import http from 'node:http';
import { env } from './src/config/env.js';
import { app } from './src/app.js';
import { info, error as logError } from './src/utils/logger.js';

const server = http.createServer(app);

server.on('error', (listenError) => {
  if (listenError.code === 'EADDRINUSE') {
    logError('server_port_in_use', {
      port: env.PORT,
      errorCode: listenError.code,
      suggestion: `Stop the process using port ${env.PORT} or start with PORT=<free_port>.`,
    });
    process.exit(1);
    return;
  }

  logError('server_listen_failed', {
    port: env.PORT,
    errorCode: listenError.code,
    errorMessage: listenError.message,
  });
  process.exit(1);
});

server.listen(env.PORT, () => {
  info('server_started', {
    port: env.PORT,
    nodeEnv: env.NODE_ENV,
  });
});

function shutdown(signal) {
  info('server_shutdown_signal_received', { signal });

  server.close((closeError) => {
    if (closeError) {
      logError('server_shutdown_failed', {
        signal,
        errorMessage: closeError.message,
      });
      process.exit(1);
      return;
    }

    info('server_shutdown_completed', { signal });
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));