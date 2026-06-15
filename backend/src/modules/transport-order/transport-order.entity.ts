import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Vehicle } from '../vehicle/vehicle.entity';
import { Fence } from '../fence/fence.entity';

export enum TransportOrderStatus {
  PENDING = 'pending',
  IN_TRANSIT = 'in_transit',
  LOADING = 'loading',
  UNLOADING = 'unloading',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  VIOLATION = 'violation',
}

@Entity('transport_orders')
export class TransportOrder {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, comment: '运输单号' })
  orderNo: string;

  @Column({ type: 'uuid', comment: '车辆ID' })
  vehicleId: string;

  @ManyToOne(() => Vehicle)
  @JoinColumn({ name: 'vehicleId' })
  vehicle: Vehicle;

  @Column({ type: 'uuid', comment: '装货点围栏ID' })
  loadingFenceId: string;

  @ManyToOne(() => Fence)
  @JoinColumn({ name: 'loadingFenceId' })
  loadingFence: Fence;

  @Column({ type: 'uuid', comment: '卸货点围栏ID' })
  unloadingFenceId: string;

  @ManyToOne(() => Fence)
  @JoinColumn({ name: 'unloadingFenceId' })
  unloadingFence: Fence;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true, comment: '计划路线(GeoJSON LineString)' })
  plannedRoute: any;

  @Column({ type: 'decimal', precision: 8, scale: 2, comment: '计划载重量(吨)' })
  plannedWeight: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true, comment: '实际载重量(吨)' })
  actualWeight: number;

  @Column({ type: 'varchar', length: 100, comment: '垃圾种类' })
  wasteType: string;

  @Column({
    type: 'enum',
    enum: TransportOrderStatus,
    default: TransportOrderStatus.PENDING,
    comment: '运输状态',
  })
  status: TransportOrderStatus;

  @Column({ type: 'timestamp', nullable: true, comment: '预计出发时间' })
  plannedDepartureTime: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '预计到达时间' })
  plannedArrivalTime: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '实际出发时间' })
  actualDepartureTime: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '到达装货点时间' })
  arrivedLoadingTime: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '装货完成时间' })
  loadingCompleteTime: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '到达卸货点时间' })
  arrivedUnloadingTime: Date;

  @Column({ type: 'timestamp', nullable: true, comment: '卸货完成时间' })
  unloadingCompleteTime: Date;

  @Column({ type: 'int', default: 0, comment: '偏离路线次数' })
  deviationCount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '总偏离距离(米)' })
  totalDeviationDistance: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '实际行驶里程(公里)' })
  actualMileage: number;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '备注' })
  remark: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
