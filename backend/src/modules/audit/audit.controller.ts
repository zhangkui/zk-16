import {
  Controller,
  Get,
  Query,
  UseGuards,
  Res,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AuditService } from './audit.service';
import { QueryAuditLogDto } from './audit.dto';
import { AuditLog, AuditModule, AuditAction } from './audit.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import * as dayjs from 'dayjs';

@ApiTags('审计日志')
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @ApiOperation({ summary: '分页查询审计日志' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', required: false, description: '页码', type: Number })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    description: '每页条数',
    type: Number,
  })
  @ApiQuery({
    name: 'module',
    required: false,
    enum: AuditModule,
    description: '操作模块',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    enum: AuditAction,
    description: '操作类型',
  })
  @ApiQuery({ name: 'userId', required: false, description: '用户ID' })
  @ApiQuery({ name: 'username', required: false, description: '用户名' })
  @ApiQuery({
    name: 'startTime',
    required: false,
    description: '开始时间',
  })
  @ApiQuery({
    name: 'endTime',
    required: false,
    description: '结束时间',
  })
  @ApiQuery({ name: 'success', required: false, description: '是否成功' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query() queryDto: QueryAuditLogDto,
  ): Promise<{ list: AuditLog[]; total: number; page: number; pageSize: number }> {
    return this.auditService.findAll(queryDto);
  }

  @Get('logs/export')
  @ApiOperation({ summary: '导出审计日志' })
  @ApiBearerAuth()
  @ApiQuery({
    name: 'module',
    required: false,
    enum: AuditModule,
    description: '操作模块',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    enum: AuditAction,
    description: '操作类型',
  })
  @ApiQuery({ name: 'userId', required: false, description: '用户ID' })
  @ApiQuery({ name: 'username', required: false, description: '用户名' })
  @ApiQuery({
    name: 'startTime',
    required: false,
    description: '开始时间',
  })
  @ApiQuery({
    name: 'endTime',
    required: false,
    description: '结束时间',
  })
  @ApiQuery({ name: 'success', required: false, description: '是否成功' })
  @UseGuards(JwtAuthGuard)
  async exportLogs(
    @Query() queryDto: QueryAuditLogDto,
    @Res() res: Response,
  ): Promise<void> {
    const csvContent = await this.auditService.exportLogs(queryDto);

    const filename = `audit-logs-${dayjs().format('YYYYMMDD-HHmmss')}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename)}"`,
    );
    res.status(HttpStatus.OK).send(csvContent);
  }
}
