import { IsString, IsNumber, IsOptional, IsNotEmpty, IsArray, ValidateNested, IsDateString, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateTrackPointDto {
  @ApiProperty({ description: '经度', example: 116.397 })
  @IsNumber()
  longitude: number;

  @ApiProperty({ description: '纬度', example: 39.908 })
  @IsNumber()
  latitude: number;

  @ApiProperty({ description: '车牌号', example: '京A12345' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiPropertyOptional({ description: 'GPS设备ID' })
  @IsOptional()
  @IsString()
  gpsDeviceId?: string;

  @ApiPropertyOptional({ description: '速度(km/h)', example: 45.5 })
  @IsOptional()
  @IsNumber()
  speed?: number;

  @ApiPropertyOptional({ description: '方向角度(0-360)', example: 90.0 })
  @IsOptional()
  @IsNumber()
  direction?: number;

  @ApiPropertyOptional({ description: '海拔(米)', example: 50.0 })
  @IsOptional()
  @IsNumber()
  altitude?: number;

  @ApiPropertyOptional({ description: '定位精度(米)', example: 5.0 })
  @IsOptional()
  @IsNumber()
  accuracy?: number;

  @ApiProperty({ description: '定位时间 (ISO 格式)', example: '2024-01-01T12:00:00Z' })
  @IsDateString({}, { message: '无效的时间格式' })
  timestamp: string;
}

export class BatchCreateTrackPointDto {
  @ApiProperty({ description: '轨迹点数组', type: [CreateTrackPointDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTrackPointDto)
  points: CreateTrackPointDto[];
}

export class QueryTrackDto {
  @ApiPropertyOptional({ description: '运输单ID' })
  @IsOptional()
  @IsString()
  transportOrderId?: string;

  @ApiPropertyOptional({ description: '车牌号' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

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

  @ApiPropertyOptional({ description: '每页数量', default: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pageSize?: number = 100;
}

export class QueryLatestPositionsDto {
  @ApiProperty({ description: '车牌号数组', type: [String] })
  @IsArray()
  @IsString({ each: true })
  plateNumbers: string[];
}
