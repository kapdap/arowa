/**
 * Logger configuration using Pino.
 */

import type { Logger, LoggerOptions, TransportSingleOptions } from 'pino';
import pino from 'pino';

/**
 * Creates and configures logger instance based on environment.
 *
 * @param service name of service using logger.
 * @param options optional logger options.
 * @returns configured pino logger instance.
 */
export function createLogger(service?: string, options?: LoggerOptions): Logger {
  const transport: TransportSingleOptions = {
    target: 'pino-pretty',
    options: {
      translateTime: true,
      hideObject:
        (process.env.LOG_OBJECT !== 'true' && process.env.NODE_ENV !== 'development') ||
        (process.env.LOG_OBJECT === 'false' && process.env.NODE_ENV === 'development'),
    },
  };

  const logger = pino({
    name: service || 'logger',
    level: process.env.LOG_LEVEL || 'info',
    enabled: process.env.LOG_ENABLED !== 'false',
    transport,
    base: {
      pid: process.pid,
      hostname: process.env.HOST || 'localhost',
    },
    ...options,
  });

  return logger;
}
