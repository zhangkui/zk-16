import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum CompanyStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('companies')
export class Company {
  @ApiProperty({ description: '公司ID' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ApiProperty({ description: '公司名称' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 200, comment: '公司名称' })
  name: string;

  @ApiProperty({ description: '统一社会信用代码' })
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, nullable: true, comment: '统一社会信用代码' })
  creditCode: string;

  @ApiProperty({ description: '联系人' })
  @Column({ type: 'varchar', length: 50, nullable: true, comment: '联系人' })
  contactPerson: string;

  @ApiProperty({ description: '联系电话' })
  @Column({ type: 'varchar', length: 20, nullable: true, comment: '联系电话' })
  contactPhone: string;

  @ApiProperty({ description: '公司地址' })
  @Column({ type: 'varchar', length: 500, nullable: true, comment: '公司地址' })
  address: string;

  @ApiProperty({ description: '经营范围' })
  @Column({ type: 'varchar', length: 500, nullable: true, comment: '经营范围' })
  businessScope: string;

  @ApiProperty({ description: '状态', enum: CompanyStatus })
  @Column({
    type: 'enum',
    enum: CompanyStatus,
    default: CompanyStatus.ACTIVE,
    comment: '状态',
  })
  status: CompanyStatus;

  @ApiProperty({ description: '备注' })
  @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
  remark: string;

  @ApiProperty({ description: '创建时间' })
  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @ApiProperty({ description: '更新时间' })
  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
