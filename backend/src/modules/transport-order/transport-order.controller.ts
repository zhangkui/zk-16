import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { TransportOrderService } from './transport-order.service';
import {
  CreateTransportOrderDto,
  UpdateTransportOrderDto,
  QueryTransportOrderDto,
  UpdateStatusDto,
  RecordDeviationDto,
} from './transport-order.dto';
import { TransportOrder } from './transport-order.entity';

@ApiTags('运输单管理')
@Controller('transport-orders')
export class TransportOrderController {
  constructor(private readonly transportOrderService: TransportOrderService) {}

  @Post()
  @ApiOperation({ summary: '创建运输单', description: '创建新的运输单，自动生成运输单号' })
  @ApiResponse({ status: 201, description: '创建成功', type: TransportOrder })
  @ApiResponse({ status: 404, description: '车辆或围栏不存在' })
  @ApiResponse({ status: 400, description: '围栏类型不正确' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createTransportOrderDto: CreateTransportOrderDto): Promise<TransportOrder> {
    return this.transportOrderService.create(createTransportOrderDto);
  }

  @Get()
  @ApiOperation({ summary: '分页查询运输单列表', description: '支持运输单号、车牌号、状态、车辆ID、日期范围筛选' })
  @ApiResponse({ status: 200, description: '查询成功' })
  findAll(
    @Query() queryTransportOrderDto: QueryTransportOrderDto,
  ): Promise<{ data: TransportOrder[]; total: number; page: number; pageSize: number }> {
    return this.transportOrderService.findAll(queryTransportOrderDto);
  }

  @Get('order-no/:orderNo')
  @ApiOperation({ summary: '根据运输单号查询', description: '通过运输单号精确查询运输单详情' })
  @ApiParam({ name: 'orderNo', description: '运输单号' })
  @ApiResponse({ status: 200, description: '查询成功', type: TransportOrder })
  @ApiResponse({ status: 404, description: '运输单不存在' })
  findByOrderNo(@Param('orderNo') orderNo: string): Promise<TransportOrder> {
    return this.transportOrderService.findByOrderNo(orderNo);
  }

  @Get('vehicle/:vehicleId/active')
  @ApiOperation({ summary: '查询车辆正在进行中的运输单', description: '获取指定车辆所有未完成的运输单' })
  @ApiParam({ name: 'vehicleId', description: '车辆ID(UUID)' })
  @ApiResponse({ status: 200, description: '查询成功' })
  findActiveOrdersByVehicle(@Param('vehicleId') vehicleId: string): Promise<TransportOrder[]> {
    return this.transportOrderService.findActiveOrdersByVehicle(vehicleId);
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID查询运输单详情', description: '通过运输单ID查询详细信息' })
  @ApiParam({ name: 'id', description: '运输单ID(UUID)' })
  @ApiResponse({ status: 200, description: '查询成功', type: TransportOrder })
  @ApiResponse({ status: 404, description: '运输单不存在' })
  findOne(@Param('id') id: string): Promise<TransportOrder> {
    return this.transportOrderService.findOne(id);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: '更新运输单状态', description: '更新运输单状态，根据状态流转自动设置相应时间' })
  @ApiParam({ name: 'id', description: '运输单ID(UUID)' })
  @ApiResponse({ status: 200, description: '更新成功', type: TransportOrder })
  @ApiResponse({ status: 400, description: '状态流转不合法或运输单已完成/取消' })
  @ApiResponse({ status: 404, description: '运输单不存在' })
  updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
  ): Promise<TransportOrder> {
    return this.transportOrderService.updateStatus(id, updateStatusDto);
  }

  @Patch(':id/deviation')
  @ApiOperation({ summary: '记录路线偏离', description: '记录运输单的路线偏离情况，增加偏离次数和累计偏离距离' })
  @ApiParam({ name: 'id', description: '运输单ID(UUID)' })
  @ApiResponse({ status: 200, description: '记录成功', type: TransportOrder })
  @ApiResponse({ status: 400, description: '运输单已完成或取消' })
  @ApiResponse({ status: 404, description: '运输单不存在' })
  recordDeviation(
    @Param('id') id: string,
    @Body() recordDeviationDto: RecordDeviationDto,
  ): Promise<TransportOrder> {
    return this.transportOrderService.recordDeviation(id, recordDeviationDto);
  }

  @Patch(':id/complete')
  @ApiOperation({ summary: '完成运输单', description: '完成运输单，校验需到达卸货点且处于卸货中状态' })
  @ApiParam({ name: 'id', description: '运输单ID(UUID)' })
  @ApiResponse({ status: 200, description: '完成成功', type: TransportOrder })
  @ApiResponse({ status: 400, description: '状态不正确或未到达卸货点' })
  @ApiResponse({ status: 404, description: '运输单不存在' })
  complete(
    @Param('id') id: string,
    @Body() body?: { actualWeight?: number },
  ): Promise<TransportOrder> {
    return this.transportOrderService.complete(id, body?.actualWeight);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: '取消运输单', description: '取消未完成的运输单' })
  @ApiParam({ name: 'id', description: '运输单ID(UUID)' })
  @ApiResponse({ status: 200, description: '取消成功', type: TransportOrder })
  @ApiResponse({ status: 400, description: '运输单已完成或已取消' })
  @ApiResponse({ status: 404, description: '运输单不存在' })
  cancel(
    @Param('id') id: string,
    @Body() body?: { remark?: string },
  ): Promise<TransportOrder> {
    return this.transportOrderService.cancel(id, body?.remark);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新运输单信息', description: '更新运输单的基础信息' })
  @ApiParam({ name: 'id', description: '运输单ID(UUID)' })
  @ApiResponse({ status: 200, description: '更新成功', type: TransportOrder })
  @ApiResponse({ status: 404, description: '运输单或关联车辆/围栏不存在' })
  update(
    @Param('id') id: string,
    @Body() updateTransportOrderDto: UpdateTransportOrderDto,
  ): Promise<TransportOrder> {
    return this.transportOrderService.update(id, updateTransportOrderDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除运输单', description: '根据ID删除运输单' })
  @ApiParam({ name: 'id', description: '运输单ID(UUID)' })
  @ApiResponse({ status: 204, description: '删除成功' })
  @ApiResponse({ status: 404, description: '运输单不存在' })
  remove(@Param('id') id: string): Promise<void> {
    return this.transportOrderService.remove(id);
  }
}
