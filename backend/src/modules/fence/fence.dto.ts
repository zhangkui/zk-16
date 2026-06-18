import { IsString, IsEnum, IsOptional, IsNumber, IsArray, IsNotEmpty, ArrayMinSize, Matches, IsPhoneNumber, IsBoolean, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { FenceType, FenceStatus } from './fence.entity';

const FENCE_TYPE_VALUES = ['loading', 'unloading', 'restricted', 'permit', 'forbidden', 'storage'];

export class CoordinateDto {
  @ApiProperty({ description: '经度', example: 116.397 })
  @IsNumber()
  lng: number;

  @ApiProperty({ description: '纬度', example: 39.908 })
  @IsNumber()
  lat: number;
}

export class CreateFenceDto {
  @ApiProperty({ description: '围栏名称', example: '东城区装载点A' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '围栏类型', enum: FENCE_TYPE_VALUES, example: 'loading' })
  @IsOptional()
  @IsIn(FENCE_TYPE_VALUES)
  fenceType?: string;

  @ApiPropertyOptional({ description: '围栏状态', enum: FenceStatus, default: FenceStatus.ACTIVE })
  @IsOptional()
  @IsEnum(FenceStatus)
  status?: FenceStatus;

  @ApiPropertyOptional({ description: '是否启用 - 别名', example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '多边形坐标点数组', type: [CoordinateDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3, { message: '围栏至少需要3个坐标点' })
  coordinates?: CoordinateDto[];

  @ApiPropertyOptional({ description: '地址', example: '北京市东城区xxx街道' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: '所属区域/行政区', example: '东城区' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: '负责人', example: '张三' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ description: '联系电话', example: '13800138000' })
  @IsOptional()
  @IsPhoneNumber('CN')
  contactPhone?: string;

  @ApiPropertyOptional({ description: '日吞吐量(吨)', example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dailyCapacity?: number;

  @ApiPropertyOptional({ description: '备注', example: '仅限工作日使用' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '描述 - 别名', example: '围栏描述信息' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '允许作业开始时间', example: '08:00:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, { message: '时间格式必须为 HH:mm:ss' })
  workStartTime?: string;

  @ApiPropertyOptional({ description: '允许作业结束时间', example: '18:00:00' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, { message: '时间格式必须为 HH:mm:ss' })
  workEndTime?: string;

  @ApiPropertyOptional({ description: '所属公司ID' })
  @IsOptional()
  @IsString()
  companyId?: string;
}

export class UpdateFenceDto {
  @ApiPropertyOptional({ description: '围栏名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '围栏类型', enum: FENCE_TYPE_VALUES })
  @IsOptional()
  @IsIn(FENCE_TYPE_VALUES)
  fenceType?: string;

  @ApiPropertyOptional({ description: '围栏状态', enum: FenceStatus })
  @IsOptional()
  @IsEnum(FenceStatus)
  status?: FenceStatus;

  @ApiPropertyOptional({ description: '是否启用 - 别名' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: '多边形坐标点数组', type: [CoordinateDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(3, { message: '围栏至少需要3个坐标点' })
  coordinates?: CoordinateDto[];

  @ApiPropertyOptional({ description: '地址' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: '所属区域/行政区' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: '负责人' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ description: '联系电话' })
  @IsOptional()
  @IsPhoneNumber('CN')
  contactPhone?: string;

  @ApiPropertyOptional({ description: '日吞吐量(吨)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  dailyCapacity?: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '描述 - 别名' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ description: '允许作业开始时间' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, { message: '时间格式必须为 HH:mm:ss' })
  workStartTime?: string;

  @ApiPropertyOptional({ description: '允许作业结束时间' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/, { message: '时间格式必须为 HH:mm:ss' })
  workEndTime?: string;

  @ApiPropertyOptional({ description: '所属公司ID' })
  @IsOptional()
  @IsString()
  companyId?: string;
}

export class UpdateFenceCoordinatesDto {
  @ApiProperty({ description: '多边形坐标点数组', type: [CoordinateDto] })
  @IsArray()
  @ArrayMinSize(3, { message: '围栏至少需要3个坐标点' })
  coordinates: CoordinateDto[];
}

export class QueryFenceDto {
  @ApiPropertyOptional({ description: '围栏类型', enum: FENCE_TYPE_VALUES })
  @IsOptional()
  @IsIn(FENCE_TYPE_VALUES)
  fenceType?: string;

  @ApiPropertyOptional({ description: '围栏状态', enum: FenceStatus })
  @IsOptional()
  @IsEnum(FenceStatus)
  status?: FenceStatus;

  @ApiPropertyOptional({ description: '所属区域/行政区' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ description: '所属公司ID' })
  @IsOptional()
  @IsString()
  companyId?: string;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  pageSize?: number = 20;
}

export class CheckPointDto {
  @ApiProperty({ description: '经度', example: 116.397 })
  @Type(() => Number)
  @IsNumber()
  lng: number;

  @ApiProperty({ description: '纬度', example: 39.908 })
  @Type(() => Number)
  @IsNumber()
  lat: number;
}

export class ToggleStatusDto {
  @ApiProperty({ description: '围栏状态', enum: FenceStatus })
  @IsOptional()
  @IsEnum(FenceStatus)
  status?: FenceStatus;

  @ApiPropertyOptional({ description: '是否启用 - 别名' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
