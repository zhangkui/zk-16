import { Module, Global, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Kafka, logLevel } from 'kafkajs';
import { KafkaService } from './kafka.service';
import { KAFKA_TOPICS } from './kafka.constants';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: Kafka,
      useFactory: (configService: ConfigService) => {
        const brokers = configService.get('KAFKA_BROKERS', 'localhost:9092').split(',');
        return new Kafka({
          clientId: 'waste-transport-backend',
          brokers,
          logLevel: logLevel.ERROR,
        });
      },
      inject: [ConfigService],
    },
    KafkaService,
  ],
  exports: [KafkaService],
})
export class KafkaModule {}
