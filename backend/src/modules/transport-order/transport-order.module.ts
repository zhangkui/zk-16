import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransportOrder } from './transport-order.entity';
import { Vehicle } from '../vehicle/vehicle.entity';
import { Fence } from '../fence/fence.entity';
import { TransportOrderService } from './transport-order.service';
import { TransportOrderController } from './transport-order.controller';

@Module({
  imports: [TypeOrmModule.forFeature([TransportOrder, Vehicle, Fence])],
  controllers: [TransportOrderController],
  providers: [TransportOrderService],
  exports: [TransportOrderService],
})
export class TransportOrderModule {}
