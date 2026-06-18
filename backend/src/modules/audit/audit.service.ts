import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { AuditLog, AuditModule, AuditAction } from './audit.entity';
import { QueryAuditLogDto, AuditLogExportOptions } from './audit.dto';
import { UserRole, User } from '../auth/user.entity';
import * as dayjs from 'dayjs';

interface UserContext {
  id: string;
  role: string;
  companyId?: string;
  isCompanySuperAdmin?: boolean;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  private isCompanyAdmin(user: UserContext): boolean {
    return (
      user.role === UserRole.COMPANY_SUPER_ADMIN ||
      user.role === UserRole.COMPANY_ADMIN
    );
  }

  async recordLog(
    data: Partial<AuditLog> & {
      userId: string;
      username: string;
      module: AuditModule;
      action: AuditAction;
      ipAddress: string;
    },
  ): Promise<AuditLog> {
    try {
      const log = this.auditLogRepository.create({
        userId: data.userId,
        username: data.username,
        department: data.department || '',
        module: data.module,
        action: data.action,
        targetId: data.targetId || '',
        targetName: data.targetName || '',
        beforeData: data.beforeData ? JSON.stringify(data.beforeData) : null,
        afterData: data.afterData ? JSON.stringify(data.afterData) : null,
        changedFields: data.changedFields
          ? JSON.stringify(data.changedFields)
          : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent || null,
        success: data.success !== undefined ? data.success : true,
        errorMessage: data.errorMessage || null,
      });

      return await this.auditLogRepository.save(log);
    } catch (error) {
      this.logger.error('记录审计日志失败:', error);
      throw error;
    }
  }

  async findAll(
    queryDto: QueryAuditLogDto,
    user: UserContext,
  ): Promise<{ list: AuditLog[]; total: number; page: number; pageSize: number }> {
    const {
      page = 1,
      pageSize = 10,
      module,
      action,
      userId,
      username,
      startTime,
      endTime,
      success,
    } = queryDto;

    const queryBuilder = this.auditLogRepository.createQueryBuilder('auditLog');

    if (this.isCompanyAdmin(user)) {
      queryBuilder.innerJoin('users', 'user', 'auditLog.userId = user.id');
      queryBuilder.andWhere('user.companyId = :companyId', { companyId: user.companyId });
    }

    if (module) {
      queryBuilder.andWhere('auditLog.module = :module', { module });
    }

    if (action) {
      queryBuilder.andWhere('auditLog.action = :action', { action });
    }

    if (userId) {
      queryBuilder.andWhere('auditLog.userId = :userId', { userId });
    }

    if (username) {
      queryBuilder.andWhere('auditLog.username = :username', { username });
    }

    if (success !== undefined) {
      queryBuilder.andWhere('auditLog.success = :success', { success });
    }

    if (startTime && endTime) {
      queryBuilder.andWhere('auditLog.createdAt BETWEEN :startTime AND :endTime', {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
      });
    } else if (startTime) {
      queryBuilder.andWhere('auditLog.createdAt >= :startTime', { startTime: new Date(startTime) });
    } else if (endTime) {
      queryBuilder.andWhere('auditLog.createdAt <= :endTime', { endTime: new Date(endTime) });
    }

    queryBuilder.orderBy('auditLog.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * pageSize);
    queryBuilder.take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();

    return { list, total, page, pageSize };
  }

  async findByModule(
    module: AuditModule,
    page: number = 1,
    pageSize: number = 10,
    user: UserContext,
  ): Promise<{ list: AuditLog[]; total: number; page: number; pageSize: number }> {
    return this.findAll({ module, page, pageSize }, user);
  }

  async findByAction(
    action: AuditAction,
    page: number = 1,
    pageSize: number = 10,
    user: UserContext,
  ): Promise<{ list: AuditLog[]; total: number; page: number; pageSize: number }> {
    return this.findAll({ action, page, pageSize }, user);
  }

  async findByUser(
    userId: string,
    page: number = 1,
    pageSize: number = 10,
    user: UserContext,
  ): Promise<{ list: AuditLog[]; total: number; page: number; pageSize: number }> {
    return this.findAll({ userId, page, pageSize }, user);
  }

  async findByTimeRange(
    startTime: string,
    endTime: string,
    page: number = 1,
    pageSize: number = 10,
    user: UserContext,
  ): Promise<{ list: AuditLog[]; total: number; page: number; pageSize: number }> {
    return this.findAll({ startTime, endTime, page, pageSize }, user);
  }

  async exportLogs(options: AuditLogExportOptions, user: UserContext): Promise<string> {
    const { module, action, userId, username, startTime, endTime, success } =
      options;

    const queryBuilder = this.auditLogRepository.createQueryBuilder('auditLog');

    if (this.isCompanyAdmin(user)) {
      queryBuilder.innerJoin('users', 'user', 'auditLog.userId = user.id');
      queryBuilder.andWhere('user.companyId = :companyId', { companyId: user.companyId });
    }

    if (module) queryBuilder.andWhere('auditLog.module = :module', { module });
    if (action) queryBuilder.andWhere('auditLog.action = :action', { action });
    if (userId) queryBuilder.andWhere('auditLog.userId = :userId', { userId });
    if (username) queryBuilder.andWhere('auditLog.username = :username', { username });
    if (success !== undefined) queryBuilder.andWhere('auditLog.success = :success', { success });
    if (startTime && endTime) {
      queryBuilder.andWhere('auditLog.createdAt BETWEEN :startTime AND :endTime', {
        startTime: new Date(startTime),
        endTime: new Date(endTime),
      });
    }

    queryBuilder.orderBy('auditLog.createdAt', 'DESC');

    const logs = await queryBuilder.getMany();

    const headers = [
      'ID',
      '用户ID',
      '用户名',
      '部门',
      '模块',
      '操作',
      '对象ID',
      '对象名称',
      'IP地址',
      'User Agent',
      '是否成功',
      '错误信息',
      '操作时间',
    ];

    const rows = logs.map((log) => [
      log.id,
      log.userId,
      log.username,
      log.department || '',
      log.module,
      log.action,
      log.targetId,
      log.targetName,
      log.ipAddress,
      log.userAgent || '',
      log.success ? '是' : '否',
      log.errorMessage || '',
      dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss'),
    ]);

    const csvContent =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row
            .map((cell) => {
              const str = String(cell);
              if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return '"' + str.replace(/"/g, '""') + '"';
              }
              return str;
            })
            .join(','),
        )
        .join('\n');

    return csvContent;
  }
}
