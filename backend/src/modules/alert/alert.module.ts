import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertService } from './alert.service';
import { AlertController } from './alert.controller';
import { Alert } from './alert.entity';
import { Vehicle } from '../vehicle/vehicle.entity';
import { KafkaModule } from '../../kafka/kafka.module';

@Module({
  imports: [TypeOrmModule.forFeature([Alert, Vehicle]), KafkaModule],
  controllers: [AlertController],
  providers: [AlertService],
  exports: [AlertService],
})
export class AlertModule {}
