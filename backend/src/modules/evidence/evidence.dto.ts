import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
  Min,
  Max,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { EvidenceType, EvidenceStatus } from './evidence.entity';

export class CreateEvidenceDto {
  @ApiPropertyOptional({ description: '关联告警ID', example: 'uuid-string' })
  @IsOptional()
  @IsString()
  alertId?: string;

  @ApiPropertyOptional({ description: '关联运输单ID', example: 'uuid-string' })
  @IsOptional()
  @IsString()
  transportOrderId?: string;

  @ApiPropertyOptional({ description: '车牌号', example: '京A12345' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({
    description: '证据类型',
    enum: EvidenceType,
    example: EvidenceType.IMAGE,
  })
  @IsOptional()
  @IsEnum(EvidenceType)
  type?: EvidenceType;

  @ApiPropertyOptional({ description: '证据文件名称', example: 'evidence_20240101.jpg' })
  @IsOptional()
  @IsString()
  fileName?: string;

  @ApiPropertyOptional({ description: '证据文件存储路径', example: '/uploads/evidence/20240101/' })
  @IsOptional()
  @IsString()
  filePath?: string;

  @ApiPropertyOptional({ description: '文件大小(字节)', example: 1024000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fileSize?: number;

  @ApiPropertyOptional({ description: '证据描述', example: '车辆违规照片' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '轨迹数据快照(JSON)' })
  @IsOptional()
  trackSnapshot?: any;

  @ApiPropertyOptional({ description: '证据采集位置经度', example: 116.4074 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: '证据采集位置纬度', example: 39.9042 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: '证据采集时间', example: '2024-01-01T10:00:00Z' })
  @IsOptional()
  @IsDateString()
  collectedAt?: Date;

  @ApiPropertyOptional({ description: '采集方式', example: '自动抓拍' })
  @IsOptional()
  @IsString()
  collectedBy?: string;
}

export class QueryEvidenceDto {
  @ApiPropertyOptional({ description: '关联告警ID' })
  @IsOptional()
  @IsString()
  alertId?: string;

  @ApiPropertyOptional({ description: '关联运输单ID' })
  @IsOptional()
  @IsString()
  transportOrderId?: string;

  @ApiPropertyOptional({ description: '车牌号(模糊查询)' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({
    description: '证据类型',
    enum: EvidenceType,
  })
  @IsOptional()
  @IsEnum(EvidenceType)
  type?: EvidenceType;

  @ApiPropertyOptional({
    description: '证据状态',
    enum: EvidenceStatus,
  })
  @IsOptional()
  @IsEnum(EvidenceStatus)
  status?: EvidenceStatus;

  @ApiPropertyOptional({ description: '页码', default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 10, example: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;
}

export class FixEvidenceDto {
  @ApiPropertyOptional({ description: '固化操作员', example: '操作员张三' })
  @IsOptional()
  @IsString()
  fixedBy?: string;
}

export class VerifyEvidenceDto {
  @ApiPropertyOptional({ description: '审核人', example: '审核员李四' })
  @IsOptional()
  @IsString()
  verifiedBy?: string;

  @ApiPropertyOptional({ description: '审核意见', example: '证据真实有效' })
  @IsOptional()
  @IsString()
  verifyRemark?: string;
}
