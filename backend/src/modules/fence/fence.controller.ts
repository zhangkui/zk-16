import { Controller, Get, Post, Body, Patch, Param, Delete, Query, HttpCode, HttpStatus, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FenceService } from './fence.service';
import { CreateFenceDto, UpdateFenceDto, UpdateFenceCoordinatesDto, QueryFenceDto, CheckPointDto, ToggleStatusDto } from './fence.dto';
import { Fence, FenceType } from './fence.entity';

@ApiTags('电子围栏管理')
@ApiBearerAuth()
@Controller('fences')
@UseGuards(JwtAuthGuard)
export class FenceController {
  constructor(private readonly fenceService: FenceService) {}

  @Post()
  @ApiOperation({ summary: '创建电子围栏（基础信息）' })
  @ApiBody({ type: CreateFenceDto })
  @ApiResponse({ status: 201, description: '围栏创建成功', type: Fence })
  @ApiResponse({ status: 400, description: '请求参数错误' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createFenceDto: CreateFenceDto, @Req() req: Request): Promise<Fence> {
    const user = (req as any).user;
    return this.fenceService.create(createFenceDto, user);
  }

  @Get()
  @ApiOperation({ summary: '分页查询围栏列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  findAll(@Query() queryFenceDto: QueryFenceDto, @Req() req: Request): Promise<{ data: Fence[]; total: number; page: number; pageSize: number }> {
    const user = (req as any).user;
    return this.fenceService.findAll(queryFenceDto, user);
  }

  @Get('type/:type')
  @ApiOperation({ summary: '根据类型查询围栏' })
  @ApiParam({ name: 'type', enum: FenceType, description: '围栏类型' })
  @ApiResponse({ status: 200, description: '查询成功', type: [Fence] })
  getFencesByType(@Param('type') type: FenceType, @Req() req: Request): Promise<Fence[]> {
    const user = (req as any).user;
    return this.fenceService.getFencesByType(type, user);
  }

  @Get('contain-point')
  @ApiOperation({ summary: '查询包含某点的所有围栏' })
  @ApiResponse({ status: 200, description: '查询成功', type: [Fence] })
  findFencesContainingPoint(@Query() checkPointDto: CheckPointDto, @Req() req: Request): Promise<Fence[]> {
    const user = (req as any).user;
    return this.fenceService.findFencesContainingPoint(checkPointDto, user);
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID查询围栏详情' })
  @ApiParam({ name: 'id', description: '围栏ID' })
  @ApiResponse({ status: 200, description: '查询成功', type: Fence })
  @ApiResponse({ status: 404, description: '围栏不存在' })
  findOne(@Param('id') id: string, @Req() req: Request): Promise<Fence> {
    const user = (req as any).user;
    return this.fenceService.findOne(id, user);
  }

  @Post(':id/check-point')
  @ApiOperation({ summary: '检查某点是否在指定围栏内' })
  @ApiParam({ name: 'id', description: '围栏ID' })
  @ApiBody({ type: CheckPointDto })
  @ApiResponse({ status: 200, description: '检查成功' })
  @ApiResponse({ status: 404, description: '围栏不存在' })
  checkPointInFence(
    @Param('id') id: string,
    @Body() checkPointDto: CheckPointDto,
    @Req() req: Request,
  ): Promise<{ inFence: boolean; fence: Fence }> {
    const user = (req as any).user;
    return this.fenceService.checkPointInFence(id, checkPointDto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新围栏基础信息' })
  @ApiParam({ name: 'id', description: '围栏ID' })
  @ApiBody({ type: UpdateFenceDto })
  @ApiResponse({ status: 200, description: '更新成功', type: Fence })
  @ApiResponse({ status: 404, description: '围栏不存在' })
  update(@Param('id') id: string, @Body() updateFenceDto: UpdateFenceDto, @Req() req: Request): Promise<Fence> {
    const user = (req as any).user;
    return this.fenceService.update(id, updateFenceDto, user);
  }

  @Patch(':id/coordinates')
  @ApiOperation({ summary: '更新围栏坐标点（地图范围）' })
  @ApiParam({ name: 'id', description: '围栏ID' })
  @ApiBody({ type: UpdateFenceCoordinatesDto })
  @ApiResponse({ status: 200, description: '坐标更新成功', type: Fence })
  @ApiResponse({ status: 400, description: '坐标点数量不足' })
  @ApiResponse({ status: 404, description: '围栏不存在' })
  updateCoordinates(
    @Param('id') id: string,
    @Body() updateCoordinatesDto: UpdateFenceCoordinatesDto,
    @Req() req: Request,
  ): Promise<Fence> {
    const user = (req as any).user;
    return this.fenceService.updateCoordinates(id, updateCoordinatesDto, user);
  }

  @Patch(':id/toggle-status')
  @ApiOperation({ summary: '切换围栏启用/禁用状态' })
  @ApiParam({ name: 'id', description: '围栏ID' })
  @ApiResponse({ status: 200, description: '状态切换成功', type: Fence })
  @ApiResponse({ status: 404, description: '围栏不存在' })
  toggleStatus(@Param('id') id: string, @Body() toggleStatusDto: ToggleStatusDto, @Req() req: Request): Promise<Fence> {
    const user = (req as any).user;
    if (toggleStatusDto && toggleStatusDto.enabled !== undefined) {
      return this.fenceService.setStatus(id, toggleStatusDto.enabled, user);
    }
    return this.fenceService.toggleStatus(id, user);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除围栏' })
  @ApiParam({ name: 'id', description: '围栏ID' })
  @ApiResponse({ status: 204, description: '删除成功' })
  @ApiResponse({ status: 404, description: '围栏不存在' })
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const user = (req as any).user;
    return this.fenceService.remove(id, user);
  }
}
