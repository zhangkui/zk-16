import { Injectable, Inject, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { Kafka, Producer, Consumer, Admin } from 'kafkajs';
import { KAFKA_TOPICS } from './kafka.constants';

@Injectable()
export class KafkaService implements OnModuleInit {
  private readonly logger = new Logger(KafkaService.name);
  private producer: Producer | null = null;
  private consumer: Consumer | null = null;
  private admin: Admin | null = null;
  private connected = false;

  constructor(
    @Inject(Kafka) private readonly kafka: Kafka,
  ) {}

  async onModuleInit() {
    try {
      this.producer = this.kafka.producer();
      this.consumer = this.kafka.consumer({ groupId: 'waste-transport-group' });
      this.admin = this.kafka.admin();

      await this.producer.connect();
      await this.consumer.connect();
      await this.admin.connect();
      this.connected = true;

      const topics = Object.values(KAFKA_TOPICS).map(topic => ({
        topic,
        numPartitions: 1,
        replicationFactor: 1,
      }));
      await this.admin.createTopics({ topics });
      this.logger.log('Kafka connected and topics initialized successfully');
    } catch (error) {
      this.connected = false;
      this.logger.warn(`Kafka connection failed, running in degraded mode: ${error.message}`);
    }
  }

  async sendMessage(topic: string, message: any, key?: string): Promise<void> {
    if (!this.connected || !this.producer) {
      this.logger.warn(`Kafka not connected, skipping message to topic ${topic}`);
      return;
    }
    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: key || Date.now().toString(),
            value: JSON.stringify(message),
          },
        ],
      });
      this.logger.debug(`Message sent to topic ${topic}`);
    } catch (error) {
      this.logger.error(`Failed to send message to topic ${topic}:`, error);
    }
  }

  async sendTrackPoint(data: any): Promise<void> {
    await this.sendMessage(KAFKA_TOPICS.TRACK_POINT, data, data.plateNumber);
  }

  async sendAlert(data: any): Promise<void> {
    await this.sendMessage(KAFKA_TOPICS.ALERT, data, data.transportOrderId);
  }

  async sendEvidence(data: any): Promise<void> {
    await this.sendMessage(KAFKA_TOPICS.EVIDENCE_COLLECT, data, data.alertId);
  }

  async sendAuditLog(data: any): Promise<void> {
    await this.sendMessage(KAFKA_TOPICS.AUDIT_LOG, data, data.userId);
  }

  async sendFenceEvent(data: any): Promise<void> {
    await this.sendMessage(KAFKA_TOPICS.FENCE_EVENT, data, data.fenceId);
  }

  async subscribe(topic: string, handler: (message: any) => Promise<void>): Promise<void> {
    if (!this.connected || !this.consumer) {
      this.logger.warn(`Kafka not connected, skipping subscription to topic ${topic}`);
      return;
    }
    await this.consumer.subscribe({ topic, fromBeginning: false });
    await this.consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          await handler(data);
        } catch (error) {
          this.logger.error(`Error processing message from topic ${topic}:`, error);
        }
      },
    });
  }

  async listTopics(): Promise<string[]> {
    if (!this.connected || !this.admin) {
      return [];
    }
    return this.admin.listTopics();
  }
}
