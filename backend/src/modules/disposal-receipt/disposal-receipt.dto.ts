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
  IsUUID,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DisposalReceiptStatus } from './disposal-receipt.entity';

export class CreateDisposalReceiptDto {
  @ApiProperty({ description: '处置联单编号', example: 'ZL20240101001' })
  @IsString()
  @IsNotEmpty()
  receiptNo: string;

  @ApiPropertyOptional({ description: '关联运输单ID', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  transportOrderId?: string;

  @ApiProperty({ description: '车牌号', example: '京A12345' })
  @IsString()
  @IsNotEmpty()
  plateNumber: string;

  @ApiProperty({ description: '运输企业名称', example: '北京市XX运输有限公司' })
  @IsString()
  @IsNotEmpty()
  companyName: string;

  @ApiProperty({ description: '产生单位', example: '北京市XX垃圾产生单位' })
  @IsString()
  @IsNotEmpty()
  generatorUnit: string;

  @ApiProperty({ description: '运输单位', example: '北京市XX运输有限公司' })
  @IsString()
  @IsNotEmpty()
  transportUnit: string;

  @ApiProperty({ description: '处置单位', example: '北京市XX垃圾处置厂' })
  @IsString()
  @IsNotEmpty()
  disposalUnit: string;

  @ApiProperty({ description: '垃圾种类', example: '建筑垃圾' })
  @IsString()
  @IsNotEmpty()
  wasteType: string;

  @ApiProperty({ description: '联单载明重量(吨)', example: 20.5 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  receiptWeight: number;

  @ApiPropertyOptional({ description: '实际称重重量(吨)', example: 20.3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualWeight?: number;

  @ApiProperty({ description: '装载日期', example: '2024-01-01' })
  @IsDateString()
  @IsNotEmpty()
  loadingDate: Date;

  @ApiProperty({ description: '装货地点', example: '北京市朝阳区XX工地' })
  @IsString()
  @IsNotEmpty()
  loadingAddress: string;

  @ApiProperty({ description: '卸货/处置地点', example: '北京市大兴区XX处置场' })
  @IsString()
  @IsNotEmpty()
  disposalAddress: string;

  @ApiPropertyOptional({ description: '装货经办人', example: '张三' })
  @IsOptional()
  @IsString()
  loadingOperator?: string;

  @ApiPropertyOptional({ description: '卸货经办人', example: '李四' })
  @IsOptional()
  @IsString()
  disposalOperator?: string;
}

export class UpdateDisposalReceiptDto {
  @ApiPropertyOptional({ description: '处置联单编号', example: 'ZL20240101001' })
  @IsOptional()
  @IsString()
  receiptNo?: string;

  @ApiPropertyOptional({ description: '关联运输单ID', example: 'uuid-string' })
  @IsOptional()
  @IsUUID()
  transportOrderId?: string;

  @ApiPropertyOptional({ description: '车牌号', example: '京A12345' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({ description: '运输企业名称', example: '北京市XX运输有限公司' })
  @IsOptional()
  @IsString()
  companyName?: string;

  @ApiPropertyOptional({ description: '产生单位', example: '北京市XX垃圾产生单位' })
  @IsOptional()
  @IsString()
  generatorUnit?: string;

  @ApiPropertyOptional({ description: '运输单位', example: '北京市XX运输有限公司' })
  @IsOptional()
  @IsString()
  transportUnit?: string;

  @ApiPropertyOptional({ description: '处置单位', example: '北京市XX垃圾处置厂' })
  @IsOptional()
  @IsString()
  disposalUnit?: string;

  @ApiPropertyOptional({ description: '垃圾种类', example: '建筑垃圾' })
  @IsOptional()
  @IsString()
  wasteType?: string;

  @ApiPropertyOptional({ description: '联单载明重量(吨)', example: 20.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  receiptWeight?: number;

  @ApiPropertyOptional({ description: '实际称重重量(吨)', example: 20.3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  actualWeight?: number;

  @ApiPropertyOptional({ description: '装载日期', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  loadingDate?: Date;

  @ApiPropertyOptional({ description: '装货地点', example: '北京市朝阳区XX工地' })
  @IsOptional()
  @IsString()
  loadingAddress?: string;

  @ApiPropertyOptional({ description: '卸货/处置地点', example: '北京市大兴区XX处置场' })
  @IsOptional()
  @IsString()
  disposalAddress?: string;

  @ApiPropertyOptional({ description: '装货经办人', example: '张三' })
  @IsOptional()
  @IsString()
  loadingOperator?: string;

  @ApiPropertyOptional({ description: '卸货经办人', example: '李四' })
  @IsOptional()
  @IsString()
  disposalOperator?: string;
}

export class QueryDisposalReceiptDto {
  @ApiPropertyOptional({ description: '联单编号(模糊查询)' })
  @IsOptional()
  @IsString()
  receiptNo?: string;

  @ApiPropertyOptional({ description: '车牌号(模糊查询)' })
  @IsOptional()
  @IsString()
  plateNumber?: string;

  @ApiPropertyOptional({
    description: '匹配状态',
    enum: DisposalReceiptStatus,
  })
  @IsOptional()
  @IsEnum(DisposalReceiptStatus)
  status?: DisposalReceiptStatus;

  @ApiPropertyOptional({ description: '垃圾种类(模糊查询)' })
  @IsOptional()
  @IsString()
  wasteType?: string;

  @ApiPropertyOptional({ description: '装载日期开始', example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  loadingDateStart?: Date;

  @ApiPropertyOptional({ description: '装载日期结束', example: '2024-01-31' })
  @IsOptional()
  @IsDateString()
  loadingDateEnd?: Date;

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

export class MatchReceiptDto {
  @ApiProperty({ description: '运输单ID', example: 'uuid-string' })
  @IsUUID()
  @IsNotEmpty()
  transportOrderId: string;

  @ApiProperty({ description: '匹配人', example: '管理员' })
  @IsString()
  @IsNotEmpty()
  matchedBy: string;
}
