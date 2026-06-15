import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsEnum,
  IsOptional,
  IsEmail,
  IsPhoneNumber,
} from 'class-validator';
import { UserRole, UserStatus } from './user.entity';

export class LoginDto {
  @ApiProperty({ description: '用户名' })
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  username: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  password: string;
}

export class RegisterDto {
  @ApiProperty({ description: '用户名' })
  @IsString()
  @IsNotEmpty({ message: '用户名不能为空' })
  @MinLength(3, { message: '用户名至少3个字符' })
  username: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @IsNotEmpty({ message: '密码不能为空' })
  @MinLength(6, { message: '密码至少6个字符' })
  password: string;

  @ApiProperty({ description: '真实姓名' })
  @IsString()
  @IsNotEmpty({ message: '真实姓名不能为空' })
  realName: string;

  @ApiProperty({ description: '角色', enum: UserRole })
  @IsEnum(UserRole, { message: '无效的角色' })
  @IsNotEmpty({ message: '角色不能为空' })
  role: UserRole;

  @ApiPropertyOptional({ description: '所属部门' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: '联系电话' })
  @IsOptional()
  @IsPhoneNumber('CN', { message: '无效的电话号码' })
  phone?: string;

  @ApiPropertyOptional({ description: '邮箱' })
  @IsOptional()
  @IsEmail({}, { message: '无效的邮箱地址' })
  email?: string;
}

export class UpdateUserDto {
  @ApiPropertyOptional({ description: '真实姓名' })
  @IsOptional()
  @IsString()
  realName?: string;

  @ApiPropertyOptional({ description: '角色', enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole, { message: '无效的角色' })
  role?: UserRole;

  @ApiPropertyOptional({ description: '所属部门' })
  @IsOptional()
  @IsString()
  department?: string;

  @ApiPropertyOptional({ description: '联系电话' })
  @IsOptional()
  @IsPhoneNumber('CN', { message: '无效的电话号码' })
  phone?: string;

  @ApiPropertyOptional({ description: '邮箱' })
  @IsOptional()
  @IsEmail({}, { message: '无效的邮箱地址' })
  email?: string;

  @ApiPropertyOptional({ description: '状态', enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus, { message: '无效的状态' })
  status?: UserStatus;

  @ApiPropertyOptional({ description: '新密码' })
  @IsOptional()
  @IsString()
  @MinLength(6, { message: '密码至少6个字符' })
  password?: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: '访问令牌' })
  accessToken: string;

  @ApiProperty({ description: '过期时间(秒)' })
  expiresIn: number;

  @ApiProperty({ description: '用户信息' })
  user: {
    id: string;
    username: string;
    realName: string;
    role: UserRole;
    department: string;
    phone: string;
    email: string;
  };
}
