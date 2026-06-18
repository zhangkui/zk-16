import { Module, Logger } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MqttService } from './mqtt.service';
import { MqttController } from './mqtt.controller';

@Module({
  imports: [ConfigModule],
  controllers: [MqttController],
  providers: [
    {
      provide: 'MQTT_BROKER_URL',
      useFactory: (configService: ConfigService) => {
        return configService.get('MQTT_BROKER_URL', 'mqtt://localhost:1883');
      },
      inject: [ConfigService],
    },
    {
      provide: 'MQTT_OPTIONS',
      useFactory: (configService: ConfigService) => {
        const username = configService.get('MQTT_USERNAME', '');
        const password = configService.get('MQTT_PASSWORD', '');
        const options: any = {};
        if (username) options.username = username;
        if (password) options.password = password;
        return options;
      },
      inject: [ConfigService],
    },
    MqttService,
  ],
  exports: [MqttService],
})
export class MqttModule {}
