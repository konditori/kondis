export type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

export type ConsoleLoggerOptions = {
  logLevels?: LogLevel[];
  timestamp?: boolean;
  prefix?: string;
  context?: string;
};

export class ConsoleLogger {
  protected context?: string;
  protected readonly options: ConsoleLoggerOptions;

  constructor();
  constructor(context: string, options?: ConsoleLoggerOptions);
  constructor(options: ConsoleLoggerOptions);
  constructor(contextOrOptions?: string | ConsoleLoggerOptions, options: ConsoleLoggerOptions = {}) {
    this.context = typeof contextOrOptions === 'string' ? contextOrOptions : contextOrOptions?.context;
    this.options = typeof contextOrOptions === 'string' ? options : (contextOrOptions ?? {});
  }

  setContext(context: string): void {
    this.context = context;
  }

  log(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('log', console.log, message, optionalParameters);
  }

  error(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('error', console.error, message, optionalParameters);
  }

  warn(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('warn', console.warn, message, optionalParameters);
  }

  debug(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('debug', console.debug, message, optionalParameters);
  }

  verbose(message: unknown, ...optionalParameters: unknown[]): void {
    this.write('verbose', console.debug, message, optionalParameters);
  }

  private write(
    level: LogLevel,
    output: (...values: unknown[]) => void,
    message: unknown,
    optionalParameters: unknown[],
  ): void {
    if (this.options.logLevels && !this.options.logLevels.includes(level)) {
      return;
    }
    const prefix = this.options.prefix ?? 'Kondis';
    const context = this.context ? ` [${this.context}]` : '';
    output(`[${prefix}] ${new Date().toISOString()} ${level.toUpperCase()}${context}`, message, ...optionalParameters);
  }
}

// Keep these methods directly on Logger.prototype so callers can spy on either logger class.
/* eslint-disable unicorn/no-useless-override */
export class Logger extends ConsoleLogger {
  override log(message: unknown, ...optionalParameters: unknown[]): void {
    super.log(message, ...optionalParameters);
  }

  override error(message: unknown, ...optionalParameters: unknown[]): void {
    super.error(message, ...optionalParameters);
  }

  override warn(message: unknown, ...optionalParameters: unknown[]): void {
    super.warn(message, ...optionalParameters);
  }

  override debug(message: unknown, ...optionalParameters: unknown[]): void {
    super.debug(message, ...optionalParameters);
  }

  override verbose(message: unknown, ...optionalParameters: unknown[]): void {
    super.verbose(message, ...optionalParameters);
  }
}
/* eslint-enable unicorn/no-useless-override */
