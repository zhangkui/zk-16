import { Controller, Get, Post, Body, Param, Delete, Patch, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';
import { SimulationService } from './simulation.service';
import { SimulatedVehicle } from './simulation.service';
import {
  StartSimulationDto,
  AddSimulatedVehicleDto,
  UpdateVehicleTargetDto,
  SetSimulationSpeedDto,
} from './simulation.dto';

@ApiTags('模拟数据')
@Controller('simulation')
export class SimulationController {
  constructor(private readonly simulationService: SimulationService) {}

  @Post('start')
  @ApiOperation({ summary: '启动模拟数据上报' })
  @ApiResponse({ status: 200, description: '启动成功' })
  @HttpCode(HttpStatus.OK)
  start(@Body() startSimulationDto: StartSimulationDto) {
    return this.simulationService.startSimulation(
      startSimulationDto.plateNumbers,
      startSimulationDto.intervalMs,
    );
  }

  @Post('stop')
  @ApiOperation({ summary: '停止模拟数据上报' })
  @ApiResponse({ status: 200, description: '停止成功' })
  @HttpCode(HttpStatus.OK)
  stop() {
    return this.simulationService.stopSimulation();
  }

  @Get('status')
  @ApiOperation({ summary: '获取模拟状态' })
  @ApiResponse({ status: 200, description: '查询成功' })
  getStatus() {
    return this.simulationService.getSimulationStatus();
  }

  @Post('vehicles')
  @ApiOperation({ summary: '添加模拟车辆' })
  @ApiResponse({ status: 201, description: '添加成功' })
  @HttpCode(HttpStatus.CREATED)
  addVehicle(@Body() addSimulatedVehicleDto: AddSimulatedVehicleDto) {
    return this.simulationService.addSimulatedVehicle(addSimulatedVehicleDto.plateNumber);
  }

  @Delete('vehicles/:plateNumber')
  @ApiOperation({ summary: '移除模拟车辆' })
  @ApiParam({ name: 'plateNumber', description: '车牌号' })
  @ApiResponse({ status: 204, description: '移除成功' })
  @HttpCode(HttpStatus.NO_CONTENT)
  removeVehicle(@Param('plateNumber') plateNumber: string) {
    const removed = this.simulationService.removeSimulatedVehicle(plateNumber);
    if (!removed) {
      return { success: false, message: '车辆不存在' };
    }
    return { success: true };
  }

  @Patch('vehicles/:plateNumber/target')
  @ApiOperation({ summary: '更新模拟车辆目标位置' })
  @ApiParam({ name: 'plateNumber', description: '车牌号' })
  @ApiResponse({ status: 200, description: '更新成功' })
  updateTarget(
    @Param('plateNumber') plateNumber: string,
    @Body() updateVehicleTargetDto: UpdateVehicleTargetDto,
  ) {
    return this.simulationService.updateVehicleTarget(
      plateNumber,
      updateVehicleTargetDto.lng,
      updateVehicleTargetDto.lat,
    );
  }

  @Patch('vehicles/:plateNumber/speed')
  @ApiOperation({ summary: '设置模拟车辆速度' })
  @ApiParam({ name: 'plateNumber', description: '车牌号' })
  @ApiResponse({ status: 200, description: '设置成功' })
  setSpeed(
    @Param('plateNumber') plateNumber: string,
    @Body() setSimulationSpeedDto: SetSimulationSpeedDto,
  ) {
    return this.simulationService.setSimulationSpeed(
      plateNumber,
      setSimulationSpeedDto.speed,
    );
  }

  @Post('reset')
  @ApiOperation({ summary: '重置模拟' })
  @ApiResponse({ status: 200, description: '重置成功' })
  @HttpCode(HttpStatus.OK)
  reset() {
    return this.simulationService.resetSimulation();
  }
}
