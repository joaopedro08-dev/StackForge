function baseLog(level, message, context = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...context,
  };

  if (level === 'error') {
    console.error(JSON.stringify(payload));
    return;
  }

  console.log(JSON.stringify(payload));
}

export function info(message, context) {
  baseLog('info', message, context);
}

export function warn(message, context) {
  baseLog('warn', message, context);
}

export function error(message, context) {
  baseLog('error', message, context);
}
