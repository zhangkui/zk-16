import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsEnum,
  IsString,
  IsInt,
  Min,
  IsDateString,
} from 'class-validator';
import { AuditModule, AuditAction } from './audit.entity';

export class QueryAuditLogDto {
  @ApiPropertyOptional({ description: '页码', type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ description: '每页条数', type: Number })
  @IsOptional()
  @IsInt()
  @Min(1)
  pageSize?: number;

  @ApiPropertyOptional({ description: '操作模块', enum: AuditModule })
  @IsOptional()
  @IsEnum(AuditModule, { message: '无效的模块' })
  module?: AuditModule;

  @ApiPropertyOptional({ description: '操作类型', enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction, { message: '无效的操作类型' })
  action?: AuditAction;

  @ApiPropertyOptional({ description: '用户ID' })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({ description: '用户名' })
  @IsOptional()
  @IsString()
  username?: string;

  @ApiPropertyOptional({ description: '开始时间 (ISO 格式)' })
  @IsOptional()
  @IsDateString({}, { message: '无效的开始时间' })
  startTime?: string;

  @ApiPropertyOptional({ description: '结束时间 (ISO 格式)' })
  @IsOptional()
  @IsDateString({}, { message: '无效的结束时间' })
  endTime?: string;

  @ApiPropertyOptional({ description: '是否成功' })
  @IsOptional()
  success?: boolean;
}

export interface AuditLogExportOptions {
  module?: AuditModule;
  action?: AuditAction;
  userId?: string;
  username?: string;
  startTime?: string;
  endTime?: string;
  success?: boolean;
}
