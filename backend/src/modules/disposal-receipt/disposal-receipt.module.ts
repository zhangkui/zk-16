import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DisposalReceipt } from './disposal-receipt.entity';
import { TransportOrder } from '../transport-order/transport-order.entity';
import { Vehicle } from '../vehicle/vehicle.entity';
import { DisposalReceiptService } from './disposal-receipt.service';
import { DisposalReceiptController } from './disposal-receipt.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DisposalReceipt, TransportOrder, Vehicle])],
  controllers: [DisposalReceiptController],
  providers: [DisposalReceiptService],
  exports: [DisposalReceiptService],
})
export class DisposalReceiptModule {}
