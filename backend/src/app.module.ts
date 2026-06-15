import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-store';
import type { RedisClientOptions } from 'redis';
import { VehicleModule } from './modules/vehicle/vehicle.module';
import { FenceModule } from './modules/fence/fence.module';
import { TransportOrderModule } from './modules/transport-order/transport-order.module';
import { TrackModule } from './modules/track/track.module';
import { AlertModule } from './modules/alert/alert.module';
import { EvidenceModule } from './modules/evidence/evidence.module';
import { AuditModule } from './modules/audit/audit.module';
import { DisposalReceiptModule } from './modules/disposal-receipt/disposal-receipt.module';
import { KafkaModule } from './kafka/kafka.module';
import { AuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: +configService.get('DB_PORT', 5432),
        username: configService.get('DB_USER', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres123'),
        database: configService.get('DB_NAME', 'waste_transport'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: true,
        logging: false,
      }),
    }),
    CacheModule.registerAsync<RedisClientOptions>({
      isGlobal: true,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        store: redisStore,
        socket: {
          host: configService.get('REDIS_HOST', 'localhost'),
          port: +configService.get('REDIS_PORT', 6379),
        },
        ttl: 600,
      }),
    }),
    EventEmitterModule.forRoot({
      global: true,
    }),
    KafkaModule,
    AuthModule,
    VehicleModule,
    FenceModule,
    TransportOrderModule,
    TrackModule,
    AlertModule,
    EvidenceModule,
    AuditModule,
    DisposalReceiptModule,
  ],
})
export class AppModule {}
