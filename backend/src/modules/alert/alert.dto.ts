import { IsString, IsNumber, IsOptional, IsNotEmpty, IsEnum, IsInt, Min, IsDateString, IsUUID, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { AlertType, AlertLevel, AlertStatus } from './alert.entity';

const ALLOWED_ALERT_TYPES = [
  AlertType.ROUTE_DEVIATION,
  AlertType.FENCE_BREACH,
  AlertType.TIME_VIOLATION,
  AlertType.WEIGHT_OVERLOAD,
  AlertType.SPEEDING,
  AlertType.STAY_TOO_LONG,
  AlertType.UNAPPROVED_VEHICLE,
  AlertType.RECEIPT_MISMATCH,
  'route_deviation',
  'fence_breach',
  'fence_violation',
  'time_violation',
  'timeout',
  'weight_overload',
  'speeding',
  'stay_too_long',
  'unapproved_vehicle',
  'receipt_mismatch',
  'other',
];

const ALLOWED_ALERT_STATUSES = [
  AlertStatus.PENDING,
  AlertStatus.ACKNOWLEDGED,
  AlertStatus.PROCESSED,
  AlertStatus.IGNORED,
  AlertStatus.CLOSED,
  'pending',
  'active',
  'acknowledged',
  'processed',
  'processing',
  'ignored',
  'closed',
];

const ALLOWED_ALERT_LEVELS = [
  AlertLevel.INFO,
  AlertLevel.WARNING,
  AlertLevel.DANGER,
  AlertLevel.CRITICAL,
  'info',
  'low',
  'warning',
  'medium',
  'danger',
  'high',
  'critical',
];

export class CreateAlertDto {
  @ApiProperty({ description: '运输单ID' })
  @IsOptional()
  @IsUUID()
  transportOrderId?: string;

  @ApiProperty({ description: '车牌号', example: '京A12345' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiProperty({ description: '告警类型', enum: AlertType })
  @IsOptional()
  @IsIn(ALLOWED_ALERT_TYPES, { message: '告警类型不正确' })
  type?: string;

  @ApiPropertyOptional({ description: '告警类型 - 别名', enum: AlertType })
  @IsOptional()
  @IsIn(ALLOWED_ALERT_TYPES, { message: '告警类型不正确' })
  alertType?: string;

  @ApiPropertyOptional({ description: '告警级别', enum: AlertLevel, default: AlertLevel.WARNING })
  @IsOptional()
  @IsIn(ALLOWED_ALERT_LEVELS, { message: '告警级别不正确' })
  level?: string;

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
  @IsIn(ALLOWED_ALERT_TYPES, { message: '告警类型不正确' })
  type?: string;

  @ApiPropertyOptional({ description: '告警类型 - 别名', enum: AlertType })
  @IsOptional()
  @IsIn(ALLOWED_ALERT_TYPES, { message: '告警类型不正确' })
  alertType?: string;

  @ApiPropertyOptional({ description: '告警级别', enum: AlertLevel })
  @IsOptional()
  @IsIn(ALLOWED_ALERT_LEVELS, { message: '告警级别不正确' })
  level?: string;

  @ApiPropertyOptional({ description: '告警状态', enum: AlertStatus })
  @IsOptional()
  @IsIn(ALLOWED_ALERT_STATUSES, { message: '告警状态不正确' })
  status?: string;

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
  @IsOptional()
  @IsString()
  handler?: string;

  @ApiPropertyOptional({ description: '处理意见', example: '已联系司机确认路线' })
  @IsOptional()
  @IsString()
  handleRemark?: string;

  @ApiPropertyOptional({ description: '处理意见 - 别名', example: '已联系司机确认路线' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '关闭说明 - 别名', example: '告警已处理' })
  @IsOptional()
  @IsString()
  processRemark?: string;
}
