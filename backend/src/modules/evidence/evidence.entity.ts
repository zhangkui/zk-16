import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum EvidenceType {
  TRACK_DATA = 'track_data',
  IMAGE = 'image',
  VIDEO = 'video',
  DOCUMENT = 'document',
  SCREENSHOT = 'screenshot',
}

export enum EvidenceStatus {
  COLLECTING = 'collecting',
  FIXED = 'fixed',
  VERIFIED = 'verified',
  ARCHIVED = 'archived',
}

@Entity('evidences')
export class Evidence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid', nullable: true, comment: '关联告警ID' })
  alertId: string;

  @Index()
  @Column({ type: 'uuid', nullable: true, comment: '关联运输单ID' })
  transportOrderId: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '车牌号' })
  plateNumber: string;

  @Column({
    type: 'enum',
    enum: EvidenceType,
    nullable: true,
    comment: '证据类型',
  })
  type: EvidenceType;

  @Column({
    type: 'enum',
    enum: EvidenceStatus,
    default: EvidenceStatus.COLLECTING,
    comment: '证据状态',
  })
  status: EvidenceStatus;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '证据文件名称' })
  fileName: string;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '证据文件存储路径' })
  filePath: string;

  @Column({ type: 'bigint', nullable: true, default: null, comment: '文件大小(字节)' })
  fileSize: number;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: '文件哈希(SHA256)' })
  fileHash: string;

  @Column({ type: 'text', nullable: true, comment: '证据描述' })
  description: string;

  @Column({ type: 'json', nullable: true, comment: '轨迹数据快照' })
  trackSnapshot: any;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true, comment: '证据采集位置经度' })
  longitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true, comment: '证据采集位置纬度' })
  latitude: number;

  @Column({ type: 'timestamp', nullable: true, comment: '证据采集时间' })
  collectedAt: Date;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '采集方式' })
  collectedBy: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '固化操作员' })
  fixedBy: string;

  @Column({ type: 'timestamp', nullable: true, comment: '证据固化时间' })
  fixedAt: Date;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '审核人' })
  verifiedBy: string;

  @Column({ type: 'timestamp', nullable: true, comment: '审核时间' })
  verifiedAt: Date;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '审核意见' })
  verifyRemark: string;

  @CreateDateColumn({ comment: '创建时间' })
  createdAt: Date;

  @UpdateDateColumn({ comment: '更新时间' })
  updatedAt: Date;
}
