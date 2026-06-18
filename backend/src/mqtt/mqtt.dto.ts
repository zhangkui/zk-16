import { IsString, IsNumber, IsOptional, IsDateString, IsArray, ValidateNested, IsNotEmpty } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class MqttVehicleDataDto {
  @ApiProperty({ description: '车牌号', example: '京A12345' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiProperty({ description: '经度', example: 116.397 })
  @IsNumber()
  longitude: number;

  @ApiProperty({ description: '纬度', example: 39.908 })
  @IsNumber()
  latitude: number;

  @ApiPropertyOptional({ description: 'GPS设备ID', example: 'GPS-20240101-001' })
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

  @ApiPropertyOptional({ description: '车辆状态：online/offline/idle', example: 'online' })
  @IsOptional()
  @IsString()
  vehicleStatus?: string;
}

export class MqttVehicleBatchDataDto {
  @ApiProperty({ description: '车辆数据数组', type: [MqttVehicleDataDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MqttVehicleDataDto)
  items: MqttVehicleDataDto[];
}
