import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsPhoneNumber,
  Min,
  Max,
  IsInt,
  IsIn,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { VehicleStatus, VehicleType } from './vehicle.entity';

export class CreateVehicleDto {
  @ApiProperty({ description: '车牌号', example: '京A12345' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiProperty({ description: '车辆识别码(VIN)', example: 'LBV5S1108FSJ12345' })
  @IsOptional()
  @IsString()
  vin?: string;

  @ApiProperty({
    description: '车辆类型(支持中文别名：厢式货车/罐式货车/自卸货车/冷藏车)',
    enum: VehicleType,
    example: VehicleType.DUMP_TRUCK,
  })
  @IsOptional()
  @IsIn([
    VehicleType.DUMP_TRUCK,
    VehicleType.MIXER_TRUCK,
    VehicleType.FLATBED,
    VehicleType.CONTAINER_TRUCK,
    '厢式货车',
    '罐式货车',
    '自卸货车',
    '冷藏车',
  ])
  vehicleType?: string;

  @ApiProperty({ description: '车辆颜色', example: '黄色' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiProperty({ description: '核定载重量(吨)', example: 20.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  loadCapacity?: number;

  @ApiProperty({ description: '核定载重量(吨) - 别名', example: 20.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capacity?: number;

  @ApiProperty({ description: '所属运输企业', example: '北京市XX运输有限公司' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiProperty({ description: '所属运输企业 - 别名', example: '北京市XX运输有限公司' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ description: '驾驶员姓名', example: '张三' })
  @IsOptional()
  @IsString()
  driverName?: string;

  @ApiPropertyOptional({ description: '驾驶员联系电话', example: '13800138000' })
  @IsOptional()
  @IsString()
  driverPhone?: string;

  @ApiPropertyOptional({ description: '驾驶员从业资格证号', example: '110101199001011234' })
  @IsOptional()
  @IsString()
  driverLicenseNo?: string;

  @ApiPropertyOptional({ description: '道路运输证号', example: '京交运管证字110101001234号' })
  @IsOptional()
  @IsString()
  transportLicenseNo?: string;

  @ApiPropertyOptional({ description: '运输证有效期截止日期', example: '2027-12-31' })
  @IsOptional()
  @IsDateString()
  licenseExpiryDate?: Date;

  @ApiProperty({ description: '是否安装GPS设备', example: true, default: true })
  @IsOptional()
  @IsBoolean()
  hasGpsDevice?: boolean;

  @ApiPropertyOptional({ description: 'GPS设备编号', example: 'GPS-20240101-001' })
  @IsOptional()
  @IsString()
  gpsDeviceId?: string;

  @ApiPropertyOptional({ description: '垃圾种类', example: '建筑垃圾' })
  @IsOptional()
  @IsString()
  wasteType?: string;

  @ApiPropertyOptional({ description: '备注', example: '备注信息' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateVehicleDto {
  @ApiPropertyOptional({ description: '车牌号', example: '京A12345' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({ description: '车辆识别码(VIN)', example: 'LBV5S1108FSJ12345' })
  @IsOptional()
  @IsString()
  vin?: string;

  @ApiPropertyOptional({
    description: '车辆类型(支持中文别名：厢式货车/罐式货车/自卸货车/冷藏车)',
    enum: VehicleType,
    example: VehicleType.DUMP_TRUCK,
  })
  @IsOptional()
  @IsIn([
    VehicleType.DUMP_TRUCK,
    VehicleType.MIXER_TRUCK,
    VehicleType.FLATBED,
    VehicleType.CONTAINER_TRUCK,
    '厢式货车',
    '罐式货车',
    '自卸货车',
    '冷藏车',
  ])
  vehicleType?: string;

  @ApiPropertyOptional({ description: '车辆颜色', example: '黄色' })
  @IsOptional()
  @IsString()
  color?: string;

  @ApiPropertyOptional({ description: '核定载重量(吨)', example: 20.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  loadCapacity?: number;

  @ApiPropertyOptional({ description: '核定载重量(吨) - 别名', example: 20.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  capacity?: number;

  @ApiPropertyOptional({ description: '所属运输企业', example: '北京市XX运输有限公司' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ description: '所属运输企业 - 别名', example: '北京市XX运输有限公司' })
  @IsOptional()
  @IsString()
  company?: string;

  @ApiPropertyOptional({ description: '驾驶员姓名', example: '张三' })
  @IsOptional()
  @IsString()
  driverName?: string;

  @ApiPropertyOptional({ description: '驾驶员联系电话', example: '13800138000' })
  @IsOptional()
  @IsPhoneNumber('CN')
  driverPhone?: string;

  @ApiPropertyOptional({ description: '驾驶员从业资格证号', example: '110101199001011234' })
  @IsOptional()
  @IsString()
  driverLicenseNo?: string;

  @ApiPropertyOptional({ description: '道路运输证号', example: '京交运管证字110101001234号' })
  @IsOptional()
  @IsString()
  transportLicenseNo?: string;

  @ApiPropertyOptional({ description: '运输证有效期截止日期', example: '2027-12-31' })
  @IsOptional()
  @IsDateString()
  licenseExpiryDate?: Date;

  @ApiPropertyOptional({ description: '是否安装GPS设备', example: true })
  @IsOptional()
  @IsBoolean()
  hasGpsDevice?: boolean;

  @ApiPropertyOptional({ description: 'GPS设备编号', example: 'GPS-20240101-001' })
  @IsOptional()
  @IsString()
  gpsDeviceId?: string;

  @ApiPropertyOptional({ description: '垃圾种类', example: '建筑垃圾' })
  @IsOptional()
  @IsString()
  wasteType?: string;

  @ApiPropertyOptional({ description: '备注', example: '备注信息' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class VerifyVehicleDto {
  @ApiProperty({ description: '车牌号', example: '京A12345' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;
}

export class QueryVehicleDto {
  @ApiPropertyOptional({ description: '车牌号(模糊查询)' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({
    description: '备案状态(支持别名：disabled对应suspended)',
    enum: VehicleStatus,
  })
  @IsOptional()
  @IsIn([
    VehicleStatus.PENDING,
    VehicleStatus.APPROVED,
    VehicleStatus.REJECTED,
    VehicleStatus.EXPIRED,
    VehicleStatus.SUSPENDED,
    'disabled',
  ])
  status?: string;

  @ApiPropertyOptional({ description: '运输企业名称(模糊查询)' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ description: '运输企业名称(模糊查询) - 别名' })
  @IsOptional()
  @IsString()
  company?: string;

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

export class ApproveVehicleDto {
  @ApiPropertyOptional({ description: '审核意见', example: '资料齐全，审核通过' })
  @IsOptional()
  @IsString()
  auditRemark?: string;

  @ApiPropertyOptional({ description: '审核意见 - 别名', example: '资料齐全，审核通过' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '审核人', example: '管理员' })
  @IsOptional()
  @IsString()
  auditor?: string;
}

export class RejectVehicleDto {
  @ApiPropertyOptional({ description: '审核意见/拒绝原因', example: '运输证已过期' })
  @IsOptional()
  @IsString()
  auditRemark?: string;

  @ApiPropertyOptional({ description: '审核意见/拒绝原因 - 别名', example: '运输证已过期' })
  @IsOptional()
  @IsString()
  remark?: string;

  @ApiPropertyOptional({ description: '审核人', example: '管理员' })
  @IsOptional()
  @IsString()
  auditor?: string;
}
