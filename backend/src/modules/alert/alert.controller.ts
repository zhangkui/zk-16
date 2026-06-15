import { Controller, Get, Post, Body, Patch, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody } from '@nestjs/swagger';
import { AlertService, AlertStatistics } from './alert.service';
import { CreateAlertDto, QueryAlertDto, HandleAlertDto } from './alert.dto';
import { Alert } from './alert.entity';

@ApiTags('告警管理')
@Controller('alerts')
export class AlertController {
  constructor(private readonly alertService: AlertService) {}

  @Post()
  @ApiOperation({ summary: '创建告警' })
  @ApiBody({ type: CreateAlertDto })
  @ApiResponse({ status: 201, description: '告警创建成功', type: Alert })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @HttpCode(HttpStatus.CREATED)
  createAlert(@Body() createAlertDto: CreateAlertDto): Promise<Alert> {
    return this.alertService.createAlert(createAlertDto);
  }

  @Get()
  @ApiOperation({ summary: '查询告警列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  findAll(
    @Query() queryAlertDto: QueryAlertDto,
  ): Promise<{ data: Alert[]; total: number; page: number; pageSize: number }> {
    return this.alertService.findAll(queryAlertDto);
  }

  @Get('active')
  @ApiOperation({ summary: '获取所有活跃告警（未关闭/未忽略）' })
  @ApiResponse({ status: 200, description: '查询成功', type: [Alert] })
  getActiveAlerts(): Promise<Alert[]> {
    return this.alertService.getActiveAlerts();
  }

  @Get('statistics')
  @ApiOperation({ summary: '获取告警统计数据' })
  @ApiResponse({ status: 200, description: '查询成功' })
  getAlertStatistics(@Query() queryAlertDto: QueryAlertDto): Promise<AlertStatistics> {
    return this.alertService.getAlertStatistics(queryAlertDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '查询告警详情' })
  @ApiParam({ name: 'id', description: '告警ID' })
  @ApiResponse({ status: 200, description: '查询成功', type: Alert })
  @ApiResponse({ status: 404, description: '告警不存在' })
  findOne(@Param('id') id: string): Promise<Alert> {
    return this.alertService.findOne(id);
  }

  @Patch(':id/acknowledge')
  @ApiOperation({ summary: '确认告警' })
  @ApiParam({ name: 'id', description: '告警ID' })
  @ApiBody({ type: HandleAlertDto })
  @ApiResponse({ status: 200, description: '确认成功', type: Alert })
  @ApiResponse({ status: 400, description: '状态不允许确认' })
  @ApiResponse({ status: 404, description: '告警不存在' })
  acknowledge(
    @Param('id') id: string,
    @Body() handleAlertDto: HandleAlertDto,
  ): Promise<Alert> {
    return this.alertService.acknowledge(id, handleAlertDto);
  }

  @Patch(':id/process')
  @ApiOperation({ summary: '处理告警' })
  @ApiParam({ name: 'id', description: '告警ID' })
  @ApiBody({ type: HandleAlertDto })
  @ApiResponse({ status: 200, description: '处理成功', type: Alert })
  @ApiResponse({ status: 400, description: '状态不允许处理' })
  @ApiResponse({ status: 404, description: '告警不存在' })
  processAlert(
    @Param('id') id: string,
    @Body() handleAlertDto: HandleAlertDto,
  ): Promise<Alert> {
    return this.alertService.processAlert(id, handleAlertDto);
  }

  @Patch(':id/close')
  @ApiOperation({ summary: '关闭告警' })
  @ApiParam({ name: 'id', description: '告警ID' })
  @ApiBody({ type: HandleAlertDto })
  @ApiResponse({ status: 200, description: '关闭成功', type: Alert })
  @ApiResponse({ status: 400, description: '告警已关闭' })
  @ApiResponse({ status: 404, description: '告警不存在' })
  closeAlert(
    @Param('id') id: string,
    @Body() handleAlertDto: HandleAlertDto,
  ): Promise<Alert> {
    return this.alertService.closeAlert(id, handleAlertDto);
  }
}
