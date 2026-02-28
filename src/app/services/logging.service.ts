import { Injectable } from '@angular/core';

export enum LogLevel {
  ALL = 0,
  DEBUG = 1,
  INFO = 2,
  WARN = 3,
  ERROR = 4
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  source?: string;
  data?: any;
  environment?: string;
}

@Injectable({ providedIn: 'root' })
export class LoggingService {
  
  /**
   * Get the minimum log level from ConfigService (populated from /api/config).
   * Falls back to window.__env for early logs before config loads.
   * Log levels: 0=All, 1=Debug, 2=Info, 3=Warn, 4=Error
   */
  private get minLevel(): LogLevel {
    // Try to read from ConfigService (exposed on window to avoid circular deps)
    // ConfigService.config() contains merged env.js + /api/config values
    const configService = (window as any).__configService;
    if (configService?.config) {
      const config = configService.config();
      // API returns LOG_LEVEL, env.js uses logLevel
      if (config?.LOG_LEVEL !== undefined) {
        return config.LOG_LEVEL;
      }
      if (config?.logLevel !== undefined) {
        return config.logLevel;
      }
    }
    
    // Fallback: check window.__env (set by env.js or Dockerfile)
    const envLogLevel = (window as any).__env?.logLevel;
    if (typeof envLogLevel === 'number') {
      return envLogLevel;
    }
    
    // Default: show all logs until config loads
    return LogLevel.ALL;
  }
  
  private get environment(): string {
    const configService = (window as any).__configService;
    if (configService?.config) {
      return configService.config()?.ENVIRONMENT || 'local';
    }
    return (window as any).__env?.ENVIRONMENT || 'local';
  }

  /**
   * Check if logging is enabled for production
   */
  private get isProduction(): boolean {
    return this.environment === 'prod';
  }

  /**
   * Check if a log level should be output
   * Only log if entry.level >= minLevel (higher level = more severe)
   */
  private shouldLog(level: LogLevel): boolean {
    return level >= this.minLevel;
  }

  /**
   * Create a log entry object
   */
  private createLogEntry(level: LogLevel, message: string, source?: string, data?: any): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      source,
      data,
      environment: this.environment
    };
  }

  /**
   * Format and output log entry to console
   */
  private output(entry: LogEntry): void {
    if (!this.shouldLog(entry.level)) {
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

  /**
   * Log an error message
   */
  error(message: string, source?: string, data?: any): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, source, data);
    this.output(entry);
  }

  /**
   * Log a warning message
   */
  warn(message: string, source?: string, data?: any): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, source, data);
    this.output(entry);
  }

  /**
   * Log an info message
   */
  info(message: string, source?: string, data?: any): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, source, data);
    this.output(entry);
  }

  /**
   * Log a debug message
   */
  debug(message: string, source?: string, data?: any): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, source, data);
    this.output(entry);
  }

  /**
   * Log a trace message (very verbose) - uses DEBUG level
   */
  trace(message: string, source?: string, data?: any): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, source, data);
    this.output(entry);
  }

  /**
   * Log HTTP request
   */
  logHttpRequest(method: string, url: string, source?: string): void {
    this.debug(`HTTP ${method} ${url}`, source || 'HttpClient');
  }

  /**
   * Log HTTP response
   */
  logHttpResponse(method: string, url: string, status: number, duration?: number, source?: string): void {
    // Only include duration if provided and this log will actually be output
    let message = `HTTP ${method} ${url} ${status}`;
    if (duration && this.shouldLog(LogLevel.DEBUG)) {
      message += ` (${duration}ms)`;
    }
    
    if (status >= 400) {
      this.error(message, source || 'HttpClient');
    } else {
      this.debug(message, source || 'HttpClient');
    }
  }

  /**
   * Log HTTP error
   */
  logHttpError(method: string, url: string, error: any, source?: string): void {
    const status = error.status || 'Unknown';
    const message = error.message || error.statusText || 'HTTP Error';
    this.error(`HTTP ${method} ${url} ${status}: ${message}`, source || 'HttpClient', error);
  }
}
