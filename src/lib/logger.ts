import pino from 'pino';
import { config } from '../config';

// Structured JSON logs in production (easy to ship to Loki/ELK/CloudWatch);
// pretty, human-readable logs in development.
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (config.isProd ? 'info' : 'debug'),
  transport: config.isProd
    ? undefined
    : { target: 'pino-pretty', options: { colorize: true, translateTime: 'SYS:HH:MM:ss' } }
});
