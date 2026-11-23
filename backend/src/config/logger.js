import pino from 'pino';
import { env } from './env.js';

export const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', 'password', 'passwordHash', 'code', 'token', '*.password', '*.code', '*.token'],
    censor: '[redacted]',
  },
  transport:
    env.isProd || env.isTest
      ? undefined
      : { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } },
});
