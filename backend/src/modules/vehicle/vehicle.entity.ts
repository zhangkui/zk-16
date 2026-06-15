import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum VehicleStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
  EXPIRED = 'expired',
  SUSPENDED = 'suspended',
}

export enum VehicleType {
  DUMP_TRUCK = 'dump_truck',
  MIXER_TRUCK = 'mixer_truck',
  FLATBED = 'flatbed',
  CONTAINER_TRUCK = 'container_truck',
}

@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, comment: '车牌号' })
  plateNumber: string;

  @Column({ type: 'varchar', length: 50, comment: '车辆识别码' })
  vin: string;

  @Column({
    type: 'enum',
    enum: VehicleType,
    comment: '车辆类型',
  })
  vehicleType: VehicleType;

  @Column({ type: 'varchar', length: 20, comment: '车辆颜色' })
  color: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, comment: '核定载重量(吨)' })
  loadCapacity: number;

  @Column({ type: 'varchar', length: 100, comment: '所属运输企业' })
  companyName: string;

  @Column({ type: 'varchar', length: 50, comment: '驾驶员姓名' })
  driverName: string;

  @Column({ type: 'varchar', length: 20, comment: '驾驶员联系电话' })
  driverPhone: string;

  @Column({ type: 'varchar', length: 50, comment: '驾驶员从业资格证号' })
  driverLicenseNo: string;

  @Column({ type: 'varchar', length: 50, comment: '道路运输证号' })
  transportLicenseNo: string;

  @Column({ type: 'date', comment: '运输证有效期截止日期' })
  licenseExpiryDate: Date;

  @Column({ type: 'boolean', default: true, comment: '是否安装GPS设备' })
  hasGpsDevice: boolean;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'GPS设备编号' })
  gpsDeviceId: string;

  @Column({
    type: 'enum',
    enum: VehicleStatus,
    default: VehicleStatus.PENDING,
    comment: '备案状态',
  })
  status: VehicleStatus;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '审核意见' })
  auditRemark: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '审核人' })
  auditor: string;

  @Column({ type: 'timestamp', nullable: true, comment: '审核时间' })
  auditTime: Date;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
