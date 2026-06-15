import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, FindOptionsWhere } from 'typeorm';
import { AuditLog, AuditModule, AuditAction } from './audit.entity';
import { QueryAuditLogDto, AuditLogExportOptions } from './audit.dto';
import * as dayjs from 'dayjs';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

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

    const where: FindOptionsWhere<AuditLog> = {};

    if (module) {
      where.module = module;
    }

    if (action) {
      where.action = action;
    }

    if (userId) {
      where.userId = userId;
    }

    if (username) {
      where.username = username;
    }

    if (success !== undefined) {
      where.success = success;
    }

    if (startTime && endTime) {
      where.createdAt = Between(
        new Date(startTime),
        new Date(endTime),
      );
    } else if (startTime) {
      where.createdAt = Between(new Date(startTime), new Date());
    } else if (endTime) {
      where.createdAt = Between(new Date(0), new Date(endTime));
    }

    const [list, total] = await this.auditLogRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { list, total, page, pageSize };
  }

  async findByModule(
    module: AuditModule,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{ list: AuditLog[]; total: number; page: number; pageSize: number }> {
    return this.findAll({ module, page, pageSize });
  }

  async findByAction(
    action: AuditAction,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{ list: AuditLog[]; total: number; page: number; pageSize: number }> {
    return this.findAll({ action, page, pageSize });
  }

  async findByUser(
    userId: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{ list: AuditLog[]; total: number; page: number; pageSize: number }> {
    return this.findAll({ userId, page, pageSize });
  }

  async findByTimeRange(
    startTime: string,
    endTime: string,
    page: number = 1,
    pageSize: number = 10,
  ): Promise<{ list: AuditLog[]; total: number; page: number; pageSize: number }> {
    return this.findAll({ startTime, endTime, page, pageSize });
  }

  async exportLogs(options: AuditLogExportOptions): Promise<string> {
    const { module, action, userId, username, startTime, endTime, success } =
      options;

    const where: FindOptionsWhere<AuditLog> = {};

    if (module) where.module = module;
    if (action) where.action = action;
    if (userId) where.userId = userId;
    if (username) where.username = username;
    if (success !== undefined) where.success = success;
    if (startTime && endTime) {
      where.createdAt = Between(new Date(startTime), new Date(endTime));
    }

    const logs = await this.auditLogRepository.find({
      where,
      order: { createdAt: 'DESC' },
    });

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
