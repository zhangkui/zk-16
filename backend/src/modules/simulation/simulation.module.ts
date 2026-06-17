import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SimulationService } from './simulation.service';
import { SimulationController } from './simulation.controller';
import { Vehicle } from '../vehicle/vehicle.entity';
import { TrackModule } from '../track/track.module';

@Module({
  imports: [TypeOrmModule.forFeature([Vehicle]), TrackModule],
  controllers: [SimulationController],
  providers: [SimulationService],
  exports: [SimulationService],
})
export class SimulationModule {}
