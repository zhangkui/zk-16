import { Injectable, Inject, Logger } from '@nestjs/common';
import { Producer, Admin, Consumer } from 'kafkajs';
import { KAFKA_PRODUCER, KAFKA_ADMIN, KAFKA_CONSUMER, KAFKA_TOPICS } from './kafka.module';

@Injectable()
export class KafkaService {
  private readonly logger = new Logger(KafkaService.name);

  constructor(
    @Inject(KAFKA_PRODUCER) private readonly producer: Producer,
    @Inject(KAFKA_CONSUMER) private readonly consumer: Consumer,
    @Inject(KAFKA_ADMIN) private readonly admin: Admin,
  ) {}

  async sendMessage(topic: string, message: any, key?: string): Promise<void> {
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
      throw error;
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
    return this.admin.listTopics();
  }
}
