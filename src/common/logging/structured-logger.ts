import { LoggerService } from '@nestjs/common';

type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'verbose' | 'fatal';

export class StructuredLogger implements LoggerService {
  log(message: unknown, ...optionalParams: unknown[]): void {
    this.write('info', message, optionalParams);
  }

  warn(message: unknown, ...optionalParams: unknown[]): void {
    this.write('warn', message, optionalParams);
  }

  error(message: unknown, ...optionalParams: unknown[]): void {
    this.write('error', message, optionalParams);
  }

  debug(message: unknown, ...optionalParams: unknown[]): void {
    this.write('debug', message, optionalParams);
  }

  verbose(message: unknown, ...optionalParams: unknown[]): void {
    this.write('verbose', message, optionalParams);
  }

  fatal(message: unknown, ...optionalParams: unknown[]): void {
    this.write('fatal', message, optionalParams);
  }

  request(record: Record<string, unknown>): void {
    process.stdout.write(`${JSON.stringify({ timestamp: new Date().toISOString(), ...record })}\n`);
  }

  private write(level: LogLevel, message: unknown, optionalParams: unknown[]): void {
    const stringParams = optionalParams.filter((value): value is string => typeof value === 'string');
    const context = stringParams[stringParams.length - 1];
    const stack = level === 'error' ? stringParams[0] : undefined;
    const record = {
      timestamp: new Date().toISOString(),
      level,
      context,
      message: this.messageText(message),
      ...(stack && stack !== context ? { stack } : {}),
    };
    const line = `${JSON.stringify(record)}\n`;
    if (level === 'error' || level === 'fatal') process.stderr.write(line);
    else process.stdout.write(line);
  }

  private messageText(message: unknown): string {
    if (message instanceof Error) return message.message;
    if (typeof message === 'string') return message;
    try {
      return JSON.stringify(message) ?? String(message);
    } catch {
      return String(message);
    }
  }
}
