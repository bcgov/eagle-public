import { Injectable } from '@angular/core';

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4
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
  private minLevel: LogLevel = LogLevel.DEBUG;
  private environment: string;
  
  constructor() {
    // Get environment directly from localStorage to avoid circular dependency
    const deployment_env = window.localStorage.getItem('from_public_server--deployment_env');
    this.environment = deployment_env || 'local';
    
    // Set minimum log level based on environment
    if (this.environment === 'prod') {
      this.minLevel = LogLevel.ERROR; // Only errors in production
    } else if (this.environment === 'test') {
      this.minLevel = LogLevel.INFO; // Info and above in test
    } else {
      this.minLevel = LogLevel.DEBUG; // Everything in dev/local
    }
  }

  /**
   * Check if logging is enabled for production
   */
  private get isProduction(): boolean {
    return this.environment === 'prod';
  }

  /**
   * Check if a log level should be output
   */
  private shouldLog(level: LogLevel): boolean {
    return level <= this.minLevel;
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
        console.log(`🟢 ${timestamp} ${prefix}`, entry.message, entry.data || '');
        break;
      case LogLevel.TRACE:
        console.log(`⚪ ${timestamp} ${prefix}`, entry.message, entry.data || '');
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
   * Log a trace message (very verbose)
   */
  trace(message: string, source?: string, data?: any): void {
    const entry = this.createLogEntry(LogLevel.TRACE, message, source, data);
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
    const durationStr = duration ? ` (${duration}ms)` : '';
    if (status >= 400) {
      this.error(`HTTP ${method} ${url} ${status}${durationStr}`, source || 'HttpClient');
    } else {
      this.debug(`HTTP ${method} ${url} ${status}${durationStr}`, source || 'HttpClient');
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
