import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FenceService } from './fence.service';
import { FenceController } from './fence.controller';
import { Fence } from './fence.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Fence])],
  controllers: [FenceController],
  providers: [FenceService],
  exports: [FenceService],
})
export class FenceModule {}
