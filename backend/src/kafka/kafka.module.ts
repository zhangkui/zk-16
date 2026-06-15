import { Module, Global, OnModuleInit, Logger, Inject } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Kafka, Producer, Consumer, Admin, logLevel } from 'kafkajs';
import { KafkaService } from './kafka.service';

export const KAFKA_PRODUCER = 'KAFKA_PRODUCER';
export const KAFKA_CONSUMER = 'KAFKA_CONSUMER';
export const KAFKA_ADMIN = 'KAFKA_ADMIN';

export const KAFKA_TOPICS = {
  TRACK_POINT: 'track.point',
  ALERT: 'waste.alert',
  VEHICLE_VERIFY: 'vehicle.verify',
  FENCE_EVENT: 'fence.event',
  DISPOSAL_MATCH: 'disposal.match',
  EVIDENCE_COLLECT: 'evidence.collect',
  AUDIT_LOG: 'audit.log',
};

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
  exports: [Kafka, KAFKA_PRODUCER, KAFKA_CONSUMER, KAFKA_ADMIN, KafkaService],
})
export class KafkaModule implements OnModuleInit {
  private readonly logger = new Logger(KafkaModule.name);

  constructor(
    @Inject(KAFKA_ADMIN) private readonly admin: Admin,
  ) {}

  async onModuleInit() {
    try {
      const topics = Object.values(KAFKA_TOPICS).map(topic => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
      }));
      await this.admin.createTopics({ topics });
      this.logger.log('Kafka topics initialized successfully');
    } catch (error) {
      this.logger.warn(`Kafka topics may already exist: ${error.message}`);
    }
  }
}
