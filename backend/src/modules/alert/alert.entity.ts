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
import { TransportOrder } from '../transport-order/transport-order.entity';

export enum AlertType {
  ROUTE_DEVIATION = 'route_deviation',
  FENCE_BREACH = 'fence_breach',
  TIME_VIOLATION = 'time_violation',
  WEIGHT_OVERLOAD = 'weight_overload',
  SPEEDING = 'speeding',
  STAY_TOO_LONG = 'stay_too_long',
  UNAPPROVED_VEHICLE = 'unapproved_vehicle',
  RECEIPT_MISMATCH = 'receipt_mismatch',
}

export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  DANGER = 'danger',
  CRITICAL = 'critical',
}

export enum AlertStatus {
  PENDING = 'pending',
  ACKNOWLEDGED = 'acknowledged',
  PROCESSED = 'processed',
  IGNORED = 'ignored',
  CLOSED = 'closed',
}

@Entity('alerts')
export class Alert {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', comment: '运输单ID' })
  transportOrderId: string;

  @ManyToOne(() => TransportOrder)
  @JoinColumn({ name: 'transportOrderId' })
  transportOrder: TransportOrder;

  @Column({ type: 'varchar', length: 50, comment: '车牌号' })
  plateNumber: string;

  @Column({
    type: 'enum',
    enum: AlertType,
    comment: '告警类型',
  })
  type: AlertType;

  @Column({
    type: 'enum',
    enum: AlertLevel,
    default: AlertLevel.WARNING,
    comment: '告警级别',
  })
  level: AlertLevel;

  @Column({
    type: 'enum',
    enum: AlertStatus,
    default: AlertStatus.PENDING,
    comment: '告警状态',
  })
  status: AlertStatus;

  @Column({ type: 'varchar', length: 500, comment: '告警标题' })
  title: string;

  @Column({ type: 'text', comment: '告警详情描述' })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true, comment: '告警位置经度' })
  longitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true, comment: '告警位置纬度' })
  latitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '偏离距离(米),路线偏离时使用' })
  deviationDistance: number;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '涉及围栏名称' })
  fenceName: string;

  @Column({ type: 'uuid', nullable: true, comment: '关联证据ID' })
  evidenceId: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '处理人' })
  handler: string;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '处理意见' })
  handleRemark: string;

  @Column({ type: 'timestamp', nullable: true, comment: '处理时间' })
  handleTime: Date;

  @Column({ type: 'int', default: 1, comment: '告警次数' })
  repeatCount: number;

  @Index()
  @Column({ type: 'timestamp', comment: '告警时间' })
  alertTime: Date;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
