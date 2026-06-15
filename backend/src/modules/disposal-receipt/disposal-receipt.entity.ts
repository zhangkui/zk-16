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

export enum DisposalReceiptStatus {
  PENDING = 'pending',
  MATCHED = 'matched',
  MISMATCHED = 'mismatched',
  EXPIRED = 'expired',
}

@Entity('disposal_receipts')
export class DisposalReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 50, comment: '处置联单编号' })
  receiptNo: string;

  @Index()
  @Column({ type: 'uuid', comment: '关联运输单ID', nullable: true })
  transportOrderId: string;

  @ManyToOne(() => TransportOrder, { nullable: true })
  @JoinColumn({ name: 'transportOrderId' })
  transportOrder: TransportOrder;

  @Column({ type: 'varchar', length: 50, comment: '车牌号' })
  plateNumber: string;

  @Column({ type: 'varchar', length: 100, comment: '运输企业名称' })
  companyName: string;

  @Column({ type: 'varchar', length: 100, comment: '产生单位' })
  generatorUnit: string;

  @Column({ type: 'varchar', length: 100, comment: '运输单位' })
  transportUnit: string;

  @Column({ type: 'varchar', length: 100, comment: '处置单位' })
  disposalUnit: string;

  @Column({ type: 'varchar', length: 100, comment: '垃圾种类' })
  wasteType: string;

  @Column({ type: 'decimal', precision: 8, scale: 2, comment: '联单载明重量(吨)' })
  receiptWeight: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true, comment: '实际称重重量(吨)' })
  actualWeight: number;

  @Column({ type: 'date', comment: '装载日期' })
  loadingDate: Date;

  @Column({ type: 'varchar', length: 200, comment: '装货地点' })
  loadingAddress: string;

  @Column({ type: 'varchar', length: 200, comment: '卸货/处置地点' })
  disposalAddress: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '装货经办人' })
  loadingOperator: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '卸货经办人' })
  disposalOperator: string;

  @Column({
    type: 'enum',
    enum: DisposalReceiptStatus,
    default: DisposalReceiptStatus.PENDING,
    comment: '匹配状态',
  })
  status: DisposalReceiptStatus;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '不匹配原因' })
  mismatchReason: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '匹配人' })
  matchedBy: string;

  @Column({ type: 'timestamp', nullable: true, comment: '匹配时间' })
  matchedAt: Date;

  @Column({ type: 'json', nullable: true, comment: '匹配字段差异详情' })
  matchDiff: any;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
