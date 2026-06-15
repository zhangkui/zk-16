import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  QUERY = 'query',
  APPROVE = 'approve',
  REJECT = 'reject',
  EXPORT = 'export',
  LOGIN = 'login',
  LOGOUT = 'logout',
  ALERT_PROCESS = 'alert_process',
  EVIDENCE_FIX = 'evidence_fix',
}

export enum AuditModule {
  VEHICLE = 'vehicle',
  FENCE = 'fence',
  TRANSPORT_ORDER = 'transport_order',
  TRACK = 'track',
  ALERT = 'alert',
  EVIDENCE = 'evidence',
  DISPOSAL_RECEIPT = 'disposal_receipt',
  USER = 'user',
  SYSTEM = 'system',
}

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 50, comment: '用户ID' })
  userId: string;

  @Column({ type: 'varchar', length: 50, comment: '用户名' })
  username: string;

  @Column({ type: 'varchar', length: 50, nullable: true, comment: '所属部门' })
  department: string;

  @Column({
    type: 'enum',
    enum: AuditModule,
    comment: '操作模块',
  })
  module: AuditModule;

  @Column({
    type: 'enum',
    enum: AuditAction,
    comment: '操作类型',
  })
  action: AuditAction;

  @Index()
  @Column({ type: 'varchar', length: 100, comment: '操作对象ID' })
  targetId: string;

  @Column({ type: 'varchar', length: 200, comment: '操作对象名称/描述' })
  targetName: string;

  @Column({ type: 'text', nullable: true, comment: '操作前数据(JSON)' })
  beforeData: string;

  @Column({ type: 'text', nullable: true, comment: '操作后数据(JSON)' })
  afterData: string;

  @Column({ type: 'text', nullable: true, comment: '变更字段详情(JSON)' })
  changedFields: string;

  @Column({ type: 'varchar', length: 50, comment: 'IP地址' })
  ipAddress: string;

  @Column({ type: 'varchar', length: 200, nullable: true, comment: '用户代理' })
  userAgent: string;

  @Column({ type: 'boolean', default: true, comment: '操作是否成功' })
  success: boolean;

  @Column({ type: 'varchar', length: 500, nullable: true, comment: '失败原因' })
  errorMessage: string;

  @Index()
  @CreateDateColumn({ comment: '操作时间' })
  createdAt: Date;
}
