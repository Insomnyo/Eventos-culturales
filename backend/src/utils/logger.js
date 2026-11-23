import pino from 'pino';
import { env } from '../config/env.js';

// Logs estructurados (JSON). Se redactan credenciales para que nunca lleguen a los logs.
export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'headers.authorization', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
});
