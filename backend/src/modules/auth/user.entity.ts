import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum UserRole {
  ADMIN = 'admin',
  TRANSPORT_ENTERPRISE = 'transport_enterprise',
  SUPERVISION = 'supervision',
  DEPARTMENT_AUDITOR = 'department_auditor',
  COMPANY_SUPER_ADMIN = 'company_super_admin',
  COMPANY_ADMIN = 'company_admin',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('users')
export class User {
  @ApiProperty({ description: '用户ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '用户名' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, comment: '用户名' })
  username: string;

  @ApiProperty({ description: '密码' })
  @Column({ type: 'varchar', length: 255, comment: '密码(加密后)' })
  password: string;

  @ApiProperty({ description: '真实姓名' })
  @Column({ type: 'varchar', length: 50, comment: '真实姓名' })
  realName: string;

  @ApiProperty({ description: '角色', enum: UserRole })
  @Column({
    type: 'enum',
    enum: UserRole,
    comment: '角色',
  })
  role: UserRole;

  @ApiProperty({ description: '所属公司ID' })
  @Column({ type: 'uuid', nullable: true, comment: '所属公司ID' })
  companyId: string;

  @ApiProperty({ description: '是否为公司超级管理员' })
  @Column({ type: 'boolean', default: false, comment: '是否为公司超级管理员' })
  isCompanySuperAdmin: boolean;

  @ApiProperty({ description: '所属部门' })
  @Column({ type: 'varchar', length: 100, nullable: true, comment: '所属部门' })
  department: string;

  @ApiProperty({ description: '联系电话' })
  @Column({ type: 'varchar', length: 20, nullable: true, comment: '联系电话' })
  phone: string;

  @ApiProperty({ description: '邮箱' })
  @Column({ type: 'varchar', length: 100, nullable: true, comment: '邮箱' })
  email: string;

  @ApiProperty({ description: '状态', enum: UserStatus })
  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.ACTIVE,
    comment: '状态',
  })
  status: UserStatus;

  @ApiProperty({ description: '最后登录时间' })
  @Column({ type: 'timestamp', nullable: true, comment: '最后登录时间' })
  lastLoginTime: Date;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
