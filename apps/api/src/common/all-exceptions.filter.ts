import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ApiError } from '@daily-stocks/shared';

const CODE_BY_STATUS: Record<number, string> = {
  400: 'BAD_REQUEST',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  500: 'INTERNAL_ERROR',
};

/**
 * 모든 에러를 {error:{code,message}} 포맷으로 통일한다 (rules/api-design.md).
 * 서비스에서 이미 해당 포맷으로 던진 HttpException은 그대로 통과시킨다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: ApiError | null = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      // 서비스가 던진 {error:{code,message}}만 통과 — Nest 기본 응답의
      // error는 'Not Found' 같은 문자열이므로 객체 여부까지 확인한다
      if (
        typeof res === 'object' &&
        res !== null &&
        'error' in res &&
        typeof res.error === 'object'
      ) {
        body = res as ApiError;
      } else {
        const message =
          typeof res === 'object' && res !== null && 'message' in res
            ? String(res.message)
            : typeof res === 'string'
              ? res
              : exception.message;
        body = {
          error: { code: CODE_BY_STATUS[status] ?? `HTTP_${status}`, message },
        };
      }
    } else {
      this.logger.error(
        `처리되지 않은 예외: ${exception instanceof Error ? exception.stack : String(exception)}`,
      );
      body = {
        error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다.' },
      };
    }

    response.status(status).json(body);
  }
}
