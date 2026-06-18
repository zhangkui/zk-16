import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { TransportOrder } from '../transport-order/transport-order.entity';

@Entity('track_points')
@Index(['transportOrderId', 'timestamp'])
export class TrackPoint {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true, comment: '运输单ID' })
  transportOrderId: string;

  @ManyToOne(() => TransportOrder)
  @JoinColumn({ name: 'transportOrderId' })
  transportOrder: TransportOrder;

  @Column({ type: 'varchar', length: 50, comment: '车牌号' })
  plateNumber: string;

  @Column({ type: 'varchar', length: 100, nullable: true, comment: 'GPS设备ID' })
  gpsDeviceId: string;

  @Column({ type: 'decimal', precision: 10, scale: 6, comment: '经度' })
  longitude: number;

  @Column({ type: 'decimal', precision: 10, scale: 6, comment: '纬度' })
  latitude: number;

  @Index({ spatial: true })
  @Column({
    type: 'geometry',
    spatialFeatureType: 'Point',
    srid: 4326,
    comment: '位置点',
  })
  location: any;

  @Column({ type: 'decimal', precision: 6, scale: 2, nullable: true, comment: '速度(km/h)' })
  speed: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true, comment: '方向角度(0-360)' })
  direction: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true, comment: '海拔(米)' })
  altitude: number;

  @Column({ type: 'decimal', precision: 8, scale: 2, nullable: true, comment: '定位精度(米)' })
  accuracy: number;

  @Column({ type: 'boolean', default: false, comment: '是否偏离路线' })
  isDeviated: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, comment: '偏离距离(米)' })
  deviationDistance: number;

  @Index()
  @Column({ type: 'timestamp', comment: '定位时间' })
  timestamp: Date;

  @CreateDateColumn({ comment: '入库时间' })
  createdAt: Date;
}
