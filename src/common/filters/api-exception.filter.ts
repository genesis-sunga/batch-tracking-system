import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const databaseCode =
      exception instanceof QueryFailedError
        ? (exception.driverError as { code?: string }).code
        : undefined;
    const isDuplicate = databaseCode === 'ER_DUP_ENTRY';
    const isReferenced = databaseCode === 'ER_ROW_IS_REFERENCED_2';
    const statusCode = isDuplicate
      ? HttpStatus.CONFLICT
      : isReferenced
        ? HttpStatus.CONFLICT
        : exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : undefined;
    const body =
      typeof exceptionResponse === 'object' && exceptionResponse !== null
        ? (exceptionResponse as Record<string, unknown>)
        : undefined;
    const message = isDuplicate
      ? 'A record with the same unique value already exists'
      : isReferenced
        ? 'This record is referenced by other records and cannot be deleted'
        : body?.message ??
          (typeof exceptionResponse === 'string' ? exceptionResponse : undefined);

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `Unhandled API error ${request.method} ${request.path}`,
        exception instanceof Error ? exception.stack : undefined,
        `requestId=${response.getHeader('X-Request-ID') ?? 'unknown'}`,
      );
    }

    response.status(statusCode).json({
      statusCode,
      error:
        typeof body?.error === 'string'
          ? body.error
          : isDuplicate || isReferenced
            ? 'Conflict'
            : exception instanceof HttpException
              ? exception.name
              : 'Internal Server Error',
      message: message ?? 'An unexpected error occurred',
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
