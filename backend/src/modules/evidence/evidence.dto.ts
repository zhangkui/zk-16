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
  @ApiProperty({ description: '关联告警ID', example: 'uuid-string' })
  @IsString()
  @IsNotEmpty()
  alertId: string;

  @ApiProperty({ description: '关联运输单ID', example: 'uuid-string' })
  @IsString()
  @IsNotEmpty()
  transportOrderId: string;

  @ApiProperty({ description: '车牌号', example: '京A12345' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiProperty({
    description: '证据类型',
    enum: EvidenceType,
    example: EvidenceType.IMAGE,
  })
  @IsEnum(EvidenceType)
  @IsNotEmpty()
  type: EvidenceType;

  @ApiProperty({ description: '证据文件名称', example: 'evidence_20240101.jpg' })
  @IsString()
  @IsNotEmpty()
  fileName: string;

  @ApiProperty({ description: '证据文件存储路径', example: '/uploads/evidence/20240101/' })
  @IsString()
  @IsNotEmpty()
  filePath: string;

  @ApiProperty({ description: '文件大小(字节)', example: 1024000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  fileSize: number;

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

  @ApiProperty({ description: '证据采集时间', example: '2024-01-01T10:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  collectedAt: Date;

  @ApiProperty({ description: '采集方式', example: '自动抓拍' })
  @IsString()
  @IsNotEmpty()
  collectedBy: string;
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
  @ApiProperty({ description: '固化操作员', example: '操作员张三' })
  @IsString()
  @IsNotEmpty()
  fixedBy: string;
}

export class VerifyEvidenceDto {
  @ApiProperty({ description: '审核人', example: '审核员李四' })
  @IsString()
  @IsNotEmpty()
  verifiedBy: string;

  @ApiPropertyOptional({ description: '审核意见', example: '证据真实有效' })
  @IsOptional()
  @IsString()
  verifyRemark?: string;
}
