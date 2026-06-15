import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsDateString,
  IsUUID,
  IsInt,
  Min,
  Max,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TransportOrderStatus } from './transport-order.entity';

class GeoJsonLineStringDto {
  @ApiProperty({ description: 'GeoJSON 类型', example: 'LineString' })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({
    description: '坐标点数组 [[lng, lat], ...]',
    example: [
      [116.397428, 39.90923],
      [116.407428, 39.91923],
    ],
  })
  @IsObject()
  coordinates: number[][];
}

export class CreateTransportOrderDto {
  @ApiProperty({ description: '车辆ID(UUID)', example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsUUID()
  @IsNotEmpty()
  vehicleId: string;

  @ApiProperty({ description: '装货点围栏ID(UUID)', example: '550e8400-e29b-41d4-a716-446655440001' })
  @IsUUID()
  @IsNotEmpty()
  loadingFenceId: string;

  @ApiProperty({ description: '卸货点围栏ID(UUID)', example: '550e8400-e29b-41d4-a716-446655440002' })
  @IsUUID()
  @IsNotEmpty()
  unloadingFenceId: string;

  @ApiProperty({ description: '计划载重量(吨)', example: 20.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedWeight: number;

  @ApiProperty({ description: '垃圾种类', example: '建筑垃圾' })
  @IsString()
  @IsNotEmpty()
  wasteType: string;

  @ApiProperty({ description: '预计出发时间', example: '2024-01-15T08:00:00Z' })
  @IsDateString()
  @IsNotEmpty()
  plannedDepartureTime: Date;

  @ApiProperty({ description: '计划路线(GeoJSON LineString 格式)', type: GeoJsonLineStringDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoJsonLineStringDto)
  plannedRoute?: GeoJsonLineStringDto;

  @ApiPropertyOptional({ description: '备注', example: '易碎物品，轻拿轻放' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateTransportOrderDto {
  @ApiPropertyOptional({ description: '车辆ID(UUID)' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ description: '装货点围栏ID(UUID)' })
  @IsOptional()
  @IsUUID()
  loadingFenceId?: string;

  @ApiPropertyOptional({ description: '卸货点围栏ID(UUID)' })
  @IsOptional()
  @IsUUID()
  unloadingFenceId?: string;

  @ApiPropertyOptional({ description: '计划路线(GeoJSON LineString 格式)', type: GeoJsonLineStringDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => GeoJsonLineStringDto)
  plannedRoute?: GeoJsonLineStringDto;

  @ApiPropertyOptional({ description: '计划载重量(吨)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  plannedWeight?: number;

  @ApiPropertyOptional({ description: '实际载重量(吨)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualWeight?: number;

  @ApiPropertyOptional({ description: '垃圾种类' })
  @IsOptional()
  @IsString()
  wasteType?: string;

  @ApiPropertyOptional({
    description: '运输状态',
    enum: TransportOrderStatus,
  })
  @IsOptional()
  @IsEnum(TransportOrderStatus)
  status?: TransportOrderStatus;

  @ApiPropertyOptional({ description: '预计出发时间' })
  @IsOptional()
  @IsDateString()
  plannedDepartureTime?: Date;

  @ApiPropertyOptional({ description: '预计到达时间' })
  @IsOptional()
  @IsDateString()
  plannedArrivalTime?: Date;

  @ApiPropertyOptional({ description: '实际出发时间' })
  @IsOptional()
  @IsDateString()
  actualDepartureTime?: Date;

  @ApiPropertyOptional({ description: '到达装货点时间' })
  @IsOptional()
  @IsDateString()
  arrivedLoadingTime?: Date;

  @ApiPropertyOptional({ description: '装货完成时间' })
  @IsOptional()
  @IsDateString()
  loadingCompleteTime?: Date;

  @ApiPropertyOptional({ description: '到达卸货点时间' })
  @IsOptional()
  @IsDateString()
  arrivedUnloadingTime?: Date;

  @ApiPropertyOptional({ description: '卸货完成时间' })
  @IsOptional()
  @IsDateString()
  unloadingCompleteTime?: Date;

  @ApiPropertyOptional({ description: '偏离路线次数' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  deviationCount?: number;

  @ApiPropertyOptional({ description: '总偏离距离(米)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  totalDeviationDistance?: number;

  @ApiPropertyOptional({ description: '实际行驶里程(公里)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualMileage?: number;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class QueryTransportOrderDto {
  @ApiPropertyOptional({ description: '运输单号(模糊查询)' })
  @IsOptional()
  @IsString()
  orderNo?: string;

  @ApiPropertyOptional({ description: '车牌号(模糊查询)' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({
    description: '运输状态',
    enum: TransportOrderStatus,
  })
  @IsOptional()
  @IsEnum(TransportOrderStatus)
  status?: TransportOrderStatus;

  @ApiPropertyOptional({ description: '车辆ID(UUID)' })
  @IsOptional()
  @IsUUID()
  vehicleId?: string;

  @ApiPropertyOptional({ description: '开始日期(查询创建时间)', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: '结束日期(查询创建时间)', example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

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

export class UpdateStatusDto {
  @ApiProperty({
    description: '运输状态',
    enum: TransportOrderStatus,
    example: TransportOrderStatus.IN_TRANSIT,
  })
  @IsEnum(TransportOrderStatus)
  @IsNotEmpty()
  status: TransportOrderStatus;

  @ApiPropertyOptional({ description: '备注', example: '已到达装货点' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class RecordDeviationDto {
  @ApiProperty({ description: '偏离距离(米)', example: 150.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  distance: number;
}
