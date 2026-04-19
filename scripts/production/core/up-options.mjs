import process from 'node:process';

const defaultDbPort = process.env.POSTGRES_HOST_PORT || '55432';

export function parseUpArgs(args) {
  const options = {
    dbPort: defaultDbPort,
    skipSmoke: false,
    build: false,
  };

  for (const arg of args) {
    if (!arg || arg === '--') {
      continue;
    }

    if (arg === '--skip-smoke') {
      options.skipSmoke = true;
      continue;
    }

    if (arg === '--build') {
      options.build = true;
      continue;
    }

    if (arg.startsWith('--db-port=')) {
      options.dbPort = arg.slice('--db-port='.length).trim();
      continue;
    }

    if (/^\d+$/.test(arg)) {
      options.dbPort = arg;
      continue;
    }

    throw new Error(`Invalid argument: ${arg}`);
  }

  if (!/^\d+$/.test(options.dbPort)) {
    throw new Error('Database port must be numeric.');
  }

  return options;
}
