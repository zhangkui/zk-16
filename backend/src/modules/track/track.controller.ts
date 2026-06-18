import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TrackService } from './track.service';
import {
  CreateTrackPointDto,
  BatchCreateTrackPointDto,
  QueryTrackDto,
  QueryLatestPositionsDto,
} from './track.dto';
import { TrackPoint } from './track.entity';

@ApiTags('轨迹管理')
@ApiBearerAuth()
@Controller('track')
@UseGuards(JwtAuthGuard)
export class TrackController {
  constructor(private readonly trackService: TrackService) {}

  @Post('point')
  @ApiOperation({ summary: '上报单个轨迹点' })
  @ApiBody({ type: CreateTrackPointDto })
  @ApiResponse({ status: 201, description: '轨迹点上报成功', type: TrackPoint })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createTrackPointDto: CreateTrackPointDto): Promise<TrackPoint> {
    return this.trackService.create(createTrackPointDto);
  }

  @Post('points')
  @ApiOperation({ summary: '批量上报轨迹点' })
  @ApiBody({ type: BatchCreateTrackPointDto })
  @ApiResponse({ status: 201, description: '批量上报成功', type: [TrackPoint] })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @HttpCode(HttpStatus.CREATED)
  batchCreate(@Body() batchDto: BatchCreateTrackPointDto): Promise<TrackPoint[]> {
    return this.trackService.batchCreate(batchDto.points);
  }

  @Get('order/:transportOrderId')
  @ApiOperation({ summary: '查询运输单轨迹' })
  @ApiParam({ name: 'transportOrderId', description: '运输单ID' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '运输单不存在' })
  getTrackByOrderId(
    @Param('transportOrderId') transportOrderId: string,
    @Query() queryTrackDto: QueryTrackDto,
    @Req() req: Request,
  ): Promise<{ data: TrackPoint[]; total: number; page: number; pageSize: number }> {
    const user = (req as any).user;
    return this.trackService.getTrackByOrderId(transportOrderId, queryTrackDto, user);
  }

  @Get()
  @ApiOperation({ summary: '查询轨迹列表（支持多条件）' })
  @ApiResponse({ status: 200, description: '查询成功' })
  queryTrack(
    @Query() queryTrackDto: QueryTrackDto,
    @Req() req: Request,
  ): Promise<{ data: TrackPoint[]; total: number; page: number; pageSize: number }> {
    const user = (req as any).user;
    return this.trackService.queryTrack(queryTrackDto, user);
  }

  @Get('latest/:plateNumber')
  @ApiOperation({ summary: '查询车辆最新位置' })
  @ApiParam({ name: 'plateNumber', description: '车牌号' })
  @ApiResponse({ status: 200, description: '查询成功' })
  @ApiResponse({ status: 404, description: '未找到轨迹数据' })
  getLatestPosition(@Param('plateNumber') plateNumber: string, @Req() req: Request): Promise<any> {
    const user = (req as any).user;
    return this.trackService.getLatestPosition(plateNumber, user);
  }

  @Post('latest/batch')
  @ApiOperation({ summary: '批量查询多辆车最新位置' })
  @ApiBody({ type: QueryLatestPositionsDto })
  @ApiResponse({ status: 200, description: '查询成功' })
  @HttpCode(HttpStatus.OK)
  getLatestPositionsByVehicles(
    @Body() queryDto: QueryLatestPositionsDto,
    @Req() req: Request,
  ): Promise<any[]> {
    const user = (req as any).user;
    return this.trackService.getLatestPositionsByVehicles(queryDto, user);
  }

  @Get('monitoring/positions')
  @ApiOperation({ summary: '查询所有可见车辆最新位置（车辆监控）' })
  @ApiResponse({ status: 200, description: '查询成功' })
  getMonitoringPositions(@Req() req: Request): Promise<any[]> {
    const user = (req as any).user;
    return this.trackService.getMonitoringPositions(user);
  }
}
