import { SetMetadata } from '@nestjs/common';
import { AuditModule, AuditAction } from './audit.entity';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMetadata {
  module: AuditModule;
  action: AuditAction;
}

export const AuditLog = (module: AuditModule, action: AuditAction) =>
  SetMetadata(AUDIT_LOG_KEY, { module, action });
