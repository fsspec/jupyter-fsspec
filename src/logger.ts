// Context aware logging system

export enum LogLevel {
  NONE = 0,
  ERROR = 1,
  WARN = 2,
  INFO = 3,
  DEBUG = 4
}

export class LogConfig {
  private static _level: LogLevel = LogLevel.INFO;

  static setLevel(level: LogLevel): void {
    LogConfig._level = level;
  }

  static getLevel(): LogLevel {
    return LogConfig._level;
  }
}

export class Logger {
  private context: string;

  constructor(context: string) {
    this.context = context;
  }

  static getLogger(context: string): Logger {
    return new Logger(context);
  }

  debug(message: string, ...args: any[]) {
    if (LogConfig.getLevel() >= LogLevel.DEBUG) {
      console.debug(`[DEBUG][${this.context}] ${message}`, ...args);
    }
  }

  info(message: string, ...args: any[]) {
    if (LogConfig.getLevel() >= LogLevel.INFO) {
      console.info(`[INFO][${this.context}] ${message}`, ...args);
    }
  }

  warn(message: string, ...args: any[]) {
    if (LogConfig.getLevel() >= LogLevel.WARN) {
      console.warn(`[WARN][${this.context}] ${message}`, ...args);
    }
  }

  error(message: string, ...args: any[]) {
    if (LogConfig.getLevel() >= LogLevel.ERROR) {
      console.error(`[ERROR][${this.context}] ${message}`, ...args);
    }
  }
}
