import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Kafka, logLevel } from 'kafkajs';
import { KafkaService } from './kafka.service';
import { KAFKA_PRODUCER, KAFKA_CONSUMER, KAFKA_ADMIN } from './kafka.constants';

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
    {
      provide: KAFKA_PRODUCER,
      useFactory: async (kafka: Kafka) => {
        const producer = kafka.producer();
        await producer.connect();
        return producer;
      },
      inject: [Kafka],
    },
    {
      provide: KAFKA_CONSUMER,
      useFactory: async (kafka: Kafka) => {
        const consumer = kafka.consumer({ groupId: 'waste-transport-group' });
        await consumer.connect();
        return consumer;
      },
      inject: [Kafka],
    },
    {
      provide: KAFKA_ADMIN,
      useFactory: async (kafka: Kafka) => {
        const admin = kafka.admin();
        await admin.connect();
        return admin;
      },
      inject: [Kafka],
    },
    KafkaService,
  ],
  exports: [KAFKA_PRODUCER, KAFKA_CONSUMER, KAFKA_ADMIN, KafkaService],
})
export class KafkaModule {}
