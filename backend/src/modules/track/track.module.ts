import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TrackService } from './track.service';
import { TrackController } from './track.controller';
import { TrackPoint } from './track.entity';
import { TransportOrder } from '../transport-order/transport-order.entity';

@Module({
  imports: [TypeOrmModule.forFeature([TrackPoint, TransportOrder])],
  controllers: [TrackController],
  providers: [TrackService],
  exports: [TrackService],
})
export class TrackModule {}
