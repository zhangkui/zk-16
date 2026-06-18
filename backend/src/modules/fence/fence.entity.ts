import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { ApiProperty } from '@nestjs/swagger';

export enum FenceType {
  LOADING = 'loading',
  UNLOADING = 'unloading',
  RESTRICTED = 'restricted',
  PERMIT = 'permit',
}

export enum FenceStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

@Entity('fences')
export class Fence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, comment: '围栏名称' })
  name: string;

  @Column({
    type: 'enum',
    enum: FenceType,
    nullable: true,
    comment: '围栏类型',
  })
  type: FenceType;

  @Column({
    type: 'enum',
    enum: FenceStatus,
    default: FenceStatus.ACTIVE,
    comment: '围栏状态',
  })
  status: FenceStatus;

  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Polygon',
    srid: 4326,
    nullable: true,
    comment: '围栏几何区域',
  })
  geom: any;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true, comment: '中心点经度' })
  centerLng: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true, comment: '中心点纬度' })
  centerLat: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0, comment: '半径(米),圆形围栏使用' })
  radius: number;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '地址' })
  address: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '所属区域/行政区' })
  district: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '负责人' })
  contactPerson: string;

  @Column({ type: 'varchar', length: 20, nullable: true, comment: '联系电话' })
  contactPhone: string;

  @Column({ type: 'decimal', precision: 8, scale: 2, default: 0, comment: '日吞吐量(吨)' })
  dailyCapacity: number;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
  remark: string;

  @Column({ type: 'time', nullable: true, comment: '允许作业开始时间' })
  workStartTime: string;

  @Column({ type: 'time', nullable: true, comment: '允许作业结束时间' })
  workEndTime: string;

  @ApiProperty({ description: '所属公司ID' })
  @Column({ type: 'uuid', nullable: true, comment: '所属公司ID' })
  companyId: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
