import { IsString, IsNumber, IsOptional, IsArray, IsInt, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class StartSimulationDto {
  @ApiPropertyOptional({ description: '要模拟的车牌号列表', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  plateNumbers?: string[];

  @ApiPropertyOptional({ description: '上报间隔时间(毫秒)', example: 3000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(500)
  intervalMs?: number;
}

export class AddSimulatedVehicleDto {
  @ApiProperty({ description: '车牌号', example: '京A12345' })
  @IsString()
  plateNumber: string;
}

export class UpdateVehicleTargetDto {
  @ApiProperty({ description: '目标经度', example: 116.4074 })
  @IsNumber()
  lng: number;

  @ApiProperty({ description: '目标纬度', example: 39.9042 })
  @IsNumber()
  lat: number;
}

export class SetSimulationSpeedDto {
  @ApiProperty({ description: '速度(km/h)', example: 50 })
  @IsNumber()
  speed: number;
}
