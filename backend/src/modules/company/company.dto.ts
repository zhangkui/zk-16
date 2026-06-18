import {
  IsString,
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { CompanyStatus } from './company.entity';

export class CreateCompanyDto {
  @ApiProperty({ description: '公司名称' })
  @IsString()
  @IsNotEmpty({ message: '公司名称不能为空' })
  name: string;

  @ApiPropertyOptional({ description: '统一社会信用代码' })
  @IsOptional()
  @IsString()
  creditCode?: string;

  @ApiPropertyOptional({ description: '联系人' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ description: '联系电话' })
  @IsOptional()
  @IsPhoneNumber('CN', { message: '无效的电话号码' })
  contactPhone?: string;

  @ApiPropertyOptional({ description: '公司地址' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: '经营范围' })
  @IsOptional()
  @IsString()
  businessScope?: string;

  @ApiPropertyOptional({ description: '超级管理员用户名' })
  @IsString()
  @IsNotEmpty({ message: '超级管理员用户名不能为空' })
  adminUsername: string;

  @ApiPropertyOptional({ description: '超级管理员密码' })
  @IsString()
  @IsNotEmpty({ message: '超级管理员密码不能为空' })
  adminPassword: string;

  @ApiPropertyOptional({ description: '超级管理员真实姓名' })
  @IsOptional()
  @IsString()
  adminRealName?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class UpdateCompanyDto {
  @ApiPropertyOptional({ description: '公司名称' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '统一社会信用代码' })
  @IsOptional()
  @IsString()
  creditCode?: string;

  @ApiPropertyOptional({ description: '联系人' })
  @IsOptional()
  @IsString()
  contactPerson?: string;

  @ApiPropertyOptional({ description: '联系电话' })
  @IsOptional()
  @IsPhoneNumber('CN', { message: '无效的电话号码' })
  contactPhone?: string;

  @ApiPropertyOptional({ description: '公司地址' })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional({ description: '经营范围' })
  @IsOptional()
  @IsString()
  businessScope?: string;

  @ApiPropertyOptional({ description: '状态', enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus, { message: '无效的状态' })
  status?: CompanyStatus;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}

export class QueryCompanyDto {
  @ApiPropertyOptional({ description: '公司名称(模糊查询)' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: '状态', enum: CompanyStatus })
  @IsOptional()
  @IsEnum(CompanyStatus, { message: '无效的状态' })
  status?: CompanyStatus;

  @ApiPropertyOptional({ description: '页码', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '每页数量', default: 10 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number = 10;
}

export class CreateCompanyUserDto {
  @ApiProperty({ description: '用户名' })
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;

  @ApiProperty({ description: '真实姓名' })
  @IsString()
  @IsNotEmpty({ message: '真实姓名不能为空' })
  realName: string;

  @ApiPropertyOptional({ description: '联系电话' })
  @IsOptional()
  @IsPhoneNumber('CN', { message: '无效的电话号码' })
  phone?: string;

  @ApiPropertyOptional({ description: '邮箱' })
  @IsOptional()
  email?: string;

  @ApiPropertyOptional({ description: '备注' })
  @IsOptional()
  @IsString()
  remark?: string;
}
