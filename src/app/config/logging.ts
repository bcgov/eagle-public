import { getConfig } from './config';
import { trackException } from './telemetry';

export enum LogLevel {
  ALL = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4,
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
  data?: any;
  environment?: string;
}

/**
 * Minimum log level from the merged config (env.js + /api/config).
 * Log levels: 0=All, 1=Debug, 2=Info, 3=Warn, 4=Error
 */
function minLevel(): LogLevel {
  const config = getConfig();
  // The API returns LOG_LEVEL, env.js uses logLevel
  const level = config.LOG_LEVEL ?? config.logLevel;
  return typeof level === 'number' ? level : LogLevel.ALL;
}

function environment(): string {
  return getConfig().ENVIRONMENT || 'local';
}

function shouldLog(level: LogLevel): boolean {
  return level >= minLevel();
}

function output(entry: LogEntry): void {
  // Reported before the console gate: a quiet LOG_LEVEL must not stop errors reaching Azure.
  if (entry.level === LogLevel.ERROR) {
    trackException(
      entry.data instanceof Error ? entry.data : entry.message,
      entry.source ? { source: entry.source } : undefined,
    );
  }

  if (!shouldLog(entry.level)) {
    return;
  }

  const prefix = entry.source ? `[${entry.source}]` : '';
  const timestamp = new Date(entry.timestamp).toLocaleTimeString();

  switch (entry.level) {
    case LogLevel.ERROR:
      console.error(`🔴 ${timestamp} ${prefix}`, entry.message, entry.data || '');
      break;
    case LogLevel.WARN:
      console.warn(`🟡 ${timestamp} ${prefix}`, entry.message, entry.data || '');
      break;
    case LogLevel.INFO:
      console.info(`🔵 ${timestamp} ${prefix}`, entry.message, entry.data || '');
      break;
    case LogLevel.DEBUG:
    case LogLevel.ALL:
      console.log(`🟢 ${timestamp} ${prefix}`, entry.message, entry.data || '');
      break;
  }
}

function log(level: LogLevel, message: string, source?: string, data?: any): void {
  output({
    timestamp: new Date().toISOString(),
    level,
    message,
    source,
    data,
    environment: environment(),
  });
}

export const logger = {
  error: (message: string, source?: string, data?: any) =>
    log(LogLevel.ERROR, message, source, data),
  warn: (message: string, source?: string, data?: any) => log(LogLevel.WARN, message, source, data),
  info: (message: string, source?: string, data?: any) => log(LogLevel.INFO, message, source, data),
  debug: (message: string, source?: string, data?: any) =>
    log(LogLevel.DEBUG, message, source, data),
  trace: (message: string, source?: string, data?: any) =>
    log(LogLevel.DEBUG, message, source, data),

  logHttpRequest(method: string, url: string, source?: string): void {
    this.debug(`HTTP ${method} ${url}`, source || 'HttpClient');
  },

  logHttpResponse(
    method: string,
    url: string,
    status: number,
    duration?: number,
    source?: string,
  ): void {
    let message = `HTTP ${method} ${url} ${status}`;
    if (duration && shouldLog(LogLevel.DEBUG)) {
      message += ` (${duration}ms)`;
    }

    if (status >= 400) {
      this.error(message, source || 'HttpClient');
    } else {
      this.debug(message, source || 'HttpClient');
    }
  },

  logHttpError(method: string, url: string, error: any, source?: string): void {
    const status = error.status || 'Unknown';
    const message = error.message || error.statusText || 'HTTP Error';
    this.error(`HTTP ${method} ${url} ${status}: ${message}`, source || 'HttpClient', error);
  },
};
