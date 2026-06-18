import { Controller, Post, Body, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MqttService, MqttVehicleData } from './mqtt.service';
import { MqttVehicleDataDto, MqttVehicleBatchDataDto } from './mqtt.dto';

@ApiTags('MQTT数据上报')
@Controller('mqtt')
@ApiBearerAuth()
export class MqttController {
  constructor(private readonly mqttService: MqttService) {}

  @Post('publish')
  @ApiOperation({ summary: '通过MQTT发布车辆数据', description: '将车辆定位数据通过MQTT发布到对应Topic' })
  @ApiResponse({ status: 200, description: '发布成功' })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @HttpCode(HttpStatus.OK)
  async publishVehicleData(@Body() dto: MqttVehicleDataDto): Promise<{ success: boolean; topic: string }> {
    const data: MqttVehicleData = { ...dto };
    const success = await this.mqttService.publishVehicleData(data);
    const topic = `vehicle/${dto.plateNumber}/data/report`;
    return { success, topic };
  }

  @Post('publish/batch')
  @ApiOperation({ summary: '通过MQTT批量发布车辆数据' })
  @ApiResponse({ status: 200, description: '发布成功' })
  @HttpCode(HttpStatus.OK)
  async publishBatchVehicleData(@Body() dto: MqttVehicleBatchDataDto): Promise<{ success: boolean; count: number }> {
    const success = await this.mqttService.publishVehicleBatchData(dto.items);
    return { success, count: dto.items.length };
  }

  @Get('status')
  @ApiOperation({ summary: '获取MQTT连接状态' })
  @ApiResponse({ status: 200, description: '查询成功' })
  getStatus(): { connected: boolean; brokerUrl: string } {
    return {
      connected: this.mqttService.isConnected(),
      brokerUrl: this.mqttService.getBrokerUrl(),
    };
  }
}
