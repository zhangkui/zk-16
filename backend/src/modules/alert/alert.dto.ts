import { IsString, IsNumber, IsOptional, IsNotEmpty, IsEnum, IsInt, Min, IsDateString, IsUUID } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AlertType, AlertLevel, AlertStatus } from './alert.entity';

export class CreateAlertDto {
  @ApiProperty({ description: '运输单ID' })
  @IsUUID()
  transportOrderId: string;

  @ApiProperty({ description: '车牌号', example: '京A12345' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiProperty({ description: '告警类型', enum: AlertType })
  @IsEnum(AlertType)
  type: AlertType;

  @ApiPropertyOptional({ description: '告警级别', enum: AlertLevel, default: AlertLevel.WARNING })
  @IsOptional()
  @IsEnum(AlertLevel)
  level?: AlertLevel;

  @ApiProperty({ description: '告警标题', example: '车辆偏离规划路线' })
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ description: '告警详情描述', example: '车辆偏离规划路线50米' })
  @IsString()
  @IsNotEmpty()
  description: string;

  @ApiPropertyOptional({ description: '告警位置经度' })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiPropertyOptional({ description: '告警位置纬度' })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiPropertyOptional({ description: '偏离距离(米),路线偏离时使用', example: 50 })
  @IsOptional()
  @IsNumber()
  deviationDistance?: number;

  @ApiPropertyOptional({ description: '涉及围栏名称' })
  @IsOptional()
  @IsString()
  fenceName?: string;

  @ApiPropertyOptional({ description: '关联证据ID' })
  @IsOptional()
  @IsUUID()
  evidenceId?: string;

  @ApiProperty({ description: '告警时间 (ISO 格式)', example: '2024-01-01T12:00:00Z' })
  @IsDateString({}, { message: '无效的时间格式' })
  alertTime: string;
}

export class QueryAlertDto {
  @ApiPropertyOptional({ description: '运输单ID' })
  @IsOptional()
  @IsUUID()
  transportOrderId?: string;

  @ApiPropertyOptional({ description: '车牌号' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({ description: '告警类型', enum: AlertType })
  @IsOptional()
  @IsEnum(AlertType)
  type?: AlertType;

  @ApiPropertyOptional({ description: '告警级别', enum: AlertLevel })
  @IsOptional()
  @IsEnum(AlertLevel)
  level?: AlertLevel;

  @ApiPropertyOptional({ description: '告警状态', enum: AlertStatus })
  @IsOptional()
  @IsEnum(AlertStatus)
  status?: AlertStatus;

  @ApiPropertyOptional({ description: '开始时间 (ISO 格式)' })
  @IsOptional()
  @IsDateString({}, { message: '无效的开始时间' })
  timeFrom?: string;

  @ApiPropertyOptional({ description: '结束时间 (ISO 格式)' })
  @IsOptional()
  @IsDateString({}, { message: '无效的结束时间' })
  timeTo?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 20;
}

export class HandleAlertDto {
  @ApiProperty({ description: '处理人', example: '张三' })
  @IsString()
  @IsNotEmpty()
  handler: string;

  @ApiPropertyOptional({ description: '处理意见', example: '已联系司机确认路线' })
  @IsOptional()
  @IsString()
  handleRemark?: string;
}
