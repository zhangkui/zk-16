import { Injectable, Logger, OnModuleInit, OnModuleDestroy, Inject, Optional } from '@nestjs/common';
import * as mqtt from 'mqtt';
import { MQTT_TOPICS } from './mqtt.constants';

export interface MqttVehicleData {
  plateNumber: string;
  longitude: number;
  latitude: number;
  gpsDeviceId?: string;
  speed?: number;
  direction?: number;
  altitude?: number;
  accuracy?: number;
  timestamp: string;
  vehicleStatus?: string;
}

@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private client: mqtt.MqttClient | null = null;
  private connected = false;
  private messageHandlers: Map<string, (topic: string, payload: any) => void> = new Map();

  constructor(
    @Inject('MQTT_BROKER_URL') private readonly brokerUrl: string,
    @Optional() @Inject('MQTT_OPTIONS') private readonly options?: any,
  ) {}

  async onModuleInit() {
    try {
      this.client = mqtt.connect(this.brokerUrl, {
        clientId: `waste-transport-backend-${Date.now()}`,
        clean: true,
        connectTimeout: 10000,
        reconnectPeriod: 5000,
        ...this.options,
      });

      this.client.on('connect', () => {
        this.connected = true;
        this.logger.log(`MQTT connected to ${this.brokerUrl}`);
        this.subscribeToDefaultTopics();
      });

      this.client.on('error', (error) => {
        this.logger.error(`MQTT connection error: ${error.message}`);
      });

      this.client.on('offline', () => {
        this.connected = false;
        this.logger.warn('MQTT client offline');
      });

      this.client.on('reconnect', () => {
        this.logger.log('MQTT client reconnecting...');
      });

      this.client.on('message', (topic, message) => {
        try {
          const payload = JSON.parse(message.toString());
          this.logger.debug(`MQTT message received on topic: ${topic}`);

          const handler = this.messageHandlers.get(topic);
          if (handler) {
            handler(topic, payload);
          }

          for (const [pattern, handler] of this.messageHandlers.entries()) {
            if (pattern.includes('+') && this.topicMatch(pattern, topic)) {
              handler(topic, payload);
            }
          }
        } catch (error) {
          this.logger.error(`Error processing MQTT message on ${topic}: ${error.message}`);
        }
      });
    } catch (error) {
      this.logger.warn(`MQTT initialization failed: ${error.message}`);
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await new Promise<void>((resolve) => {
        this.client!.end(false, {}, () => {
          this.connected = false;
          this.logger.log('MQTT client disconnected');
          resolve();
        });
      });
    }
  }

  private subscribeToDefaultTopics() {
    if (!this.client) return;

    const topics = [
      MQTT_TOPICS.VEHICLE_DATA_REPORT,
      MQTT_TOPICS.VEHICLE_DATA_BATCH,
      MQTT_TOPICS.VEHICLE_STATUS,
    ];

    for (const topic of topics) {
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          this.logger.error(`Failed to subscribe to ${topic}: ${err.message}`);
        } else {
          this.logger.log(`Subscribed to MQTT topic: ${topic}`);
        }
      });
    }
  }

  private topicMatch(pattern: string, topic: string): boolean {
    const patternParts = pattern.split('/');
    const topicParts = topic.split('/');
    if (patternParts.length !== topicParts.length) return false;
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i] !== '+' && patternParts[i] !== topicParts[i]) return false;
    }
    return true;
  }

  async publish(topic: string, payload: any, qos: 0 | 1 | 2 = 1): Promise<boolean> {
    if (!this.connected || !this.client) {
      this.logger.warn(`MQTT not connected, skipping publish to ${topic}`);
      return false;
    }

    return new Promise((resolve) => {
      this.client!.publish(topic, JSON.stringify(payload), { qos }, (error) => {
        if (error) {
          this.logger.error(`Failed to publish to ${topic}: ${error.message}`);
          resolve(false);
        } else {
          this.logger.debug(`Published to MQTT topic: ${topic}`);
          resolve(true);
        }
      });
    });
  }

  async publishVehicleData(data: MqttVehicleData): Promise<boolean> {
    const topic = `vehicle/${data.plateNumber}/data/report`;
    return this.publish(topic, data);
  }

  async publishVehicleBatchData(items: MqttVehicleData[]): Promise<boolean> {
    return this.publish(MQTT_TOPICS.VEHICLE_DATA_BATCH, { items });
  }

  async subscribe(topic: string, handler: (topic: string, payload: any) => void): Promise<void> {
    this.messageHandlers.set(topic, handler);

    if (this.client && this.connected) {
      this.client.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          this.logger.error(`Failed to subscribe to ${topic}: ${err.message}`);
        }
      });
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  getBrokerUrl(): string {
    return this.brokerUrl;
  }
}
