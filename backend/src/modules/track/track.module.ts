import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackService } from './track.service';
import { TrackController } from './track.controller';
import { TrackPoint } from './track.entity';
import { TransportOrder } from '../transport-order/transport-order.entity';
import { Fence } from '../fence/fence.entity';
import { Alert } from '../alert/alert.entity';
import { KafkaModule } from '../../kafka/kafka.module';

@Module({
  imports: [TypeOrmModule.forFeature([TrackPoint, TransportOrder, Fence, Alert]), KafkaModule],
  controllers: [TrackController],
  providers: [TrackService],
  exports: [TrackService],
})
export class TrackModule {}
