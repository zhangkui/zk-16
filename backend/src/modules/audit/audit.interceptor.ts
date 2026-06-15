import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';
import { AuditService } from './audit.service';
import { AUDIT_LOG_KEY, AuditLogMetadata } from './audit.decorator';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private reflector: Reflector,
    private auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const metadata = this.reflector.get<AuditLogMetadata>(
      AUDIT_LOG_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const user = request['user'];
    const userId = user?.id || 'anonymous';
    const username = user?.username || 'anonymous';
    const department = user?.department || '';
    const ipAddress =
      request.ip ||
      (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      request.connection?.remoteAddress ||
      'unknown';
    const userAgent = request.headers['user-agent'] || '';

    const { module, action } = metadata;

    return next.handle().pipe(
      tap(async (data) => {
        try {
          let targetId = '';
          let targetName = '';
          let afterData = null;

          if (data && typeof data === 'object') {
            targetId = data.id || '';
            targetName = data.name || data.username || data.title || '';
            afterData = data;
          }

          await this.auditService.recordLog({
            userId,
            username,
            department,
            module,
            action,
            targetId,
            targetName,
            afterData,
            ipAddress,
            userAgent,
            success: true,
          });
        } catch (error) {
          this.logger.error('记录审计日志失败:', error);
        }
      }),
      catchError(async (error) => {
        try {
          await this.auditService.recordLog({
            userId,
            username,
            department,
            module,
            action,
            targetId: '',
            targetName: '',
            ipAddress,
            userAgent,
            success: false,
            errorMessage: error.message || '未知错误',
          });
        } catch (logError) {
          this.logger.error('记录审计日志失败:', logError);
        }
        return throwError(() => error);
      }),
    );
  }
}
