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
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { VehicleService } from './vehicle.service';
import {
  CreateVehicleDto,
  UpdateVehicleDto,
  VerifyVehicleDto,
  QueryVehicleDto,
  ApproveVehicleDto,
  RejectVehicleDto,
} from './vehicle.dto';
import { Vehicle } from './vehicle.entity';

@ApiTags('车辆备案')
@Controller('vehicles')
@ApiBearerAuth()
export class VehicleController {
  constructor(private readonly vehicleService: VehicleService) {}

  @Post()
  @ApiOperation({ summary: '创建车辆备案记录', description: '提交车辆备案申请，状态默认为待审核(pending)' })
  @ApiResponse({ status: 201, description: '创建成功', type: Vehicle })
  @ApiResponse({ status: 409, description: '车牌号已存在' })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createVehicleDto: CreateVehicleDto,
    @Req() req: Request,
  ): Promise<Vehicle> {
    const user = req['user'];
    return this.vehicleService.create(createVehicleDto, user);
  }

  @Get()
  @ApiOperation({ summary: '分页查询车辆备案列表', description: '支持车牌号、状态、企业名称筛选，分页返回' })
  @ApiResponse({ status: 200, description: '查询成功' })
  findAll(
    @Query() queryVehicleDto: QueryVehicleDto,
    @Req() req: Request,
  ): Promise<{ data: Vehicle[]; total: number; page: number; pageSize: number }> {
    const user = req['user'];
    return this.vehicleService.findAll(queryVehicleDto, user);
  }

  @Get('verify')
  @ApiOperation({ summary: '核验车辆合法性', description: '根据车牌号核验车辆是否已备案、审核通过且运输证未过期' })
  @ApiResponse({ status: 200, description: '核验完成' })
  @ApiQuery({ name: 'plateNumber', description: '车牌号', required: true })
  verify(@Query() verifyVehicleDto: VerifyVehicleDto): Promise<{ valid: boolean; vehicle?: Vehicle; reason?: string }> {
    return this.vehicleService.verify(verifyVehicleDto.plateNumber);
  }

  @Get('plate/:plateNumber')
  @ApiOperation({ summary: '根据车牌号查询车辆', description: '通过车牌号精确查询车辆备案信息' })
  @ApiParam({ name: 'plateNumber', description: '车牌号' })
  @ApiResponse({ status: 200, description: '查询成功', type: Vehicle })
  @ApiResponse({ status: 404, description: '车辆不存在' })
  findByPlateNumber(
    @Param('plateNumber') plateNumber: string,
    @Req() req: Request,
  ): Promise<Vehicle> {
    const user = req['user'];
    return this.vehicleService.findByPlateNumber(plateNumber, user);
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID查询车辆详情', description: '通过车辆ID查询详细备案信息' })
  @ApiParam({ name: 'id', description: '车辆ID(UUID)' })
  @ApiResponse({ status: 200, description: '查询成功', type: Vehicle })
  @ApiResponse({ status: 404, description: '车辆不存在' })
  findOne(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Vehicle> {
    const user = req['user'];
    return this.vehicleService.findOne(id, user);
  }

  @Patch(':id/approve')
  @ApiOperation({ summary: '审核通过车辆备案', description: '将车辆备案状态设置为已通过(approved)' })
  @ApiParam({ name: 'id', description: '车辆ID(UUID)' })
  @ApiResponse({ status: 200, description: '审核成功', type: Vehicle })
  @ApiResponse({ status: 400, description: '重复审核或状态异常' })
  @ApiResponse({ status: 404, description: '车辆不存在' })
  approve(
    @Param('id') id: string,
    @Body() approveVehicleDto: ApproveVehicleDto,
    @Req() req: Request,
  ): Promise<Vehicle> {
    const user = req['user'];
    return this.vehicleService.approve(id, approveVehicleDto, user);
  }

  @Patch(':id/reject')
  @ApiOperation({ summary: '审核拒绝车辆备案', description: '将车辆备案状态设置为已拒绝(rejected)' })
  @ApiParam({ name: 'id', description: '车辆ID(UUID)' })
  @ApiResponse({ status: 200, description: '审核成功', type: Vehicle })
  @ApiResponse({ status: 400, description: '重复审核或状态异常' })
  @ApiResponse({ status: 404, description: '车辆不存在' })
  reject(
    @Param('id') id: string,
    @Body() rejectVehicleDto: RejectVehicleDto,
    @Req() req: Request,
  ): Promise<Vehicle> {
    const user = req['user'];
    return this.vehicleService.reject(id, rejectVehicleDto, user);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新车辆备案信息', description: '更新车辆的备案信息' })
  @ApiParam({ name: 'id', description: '车辆ID(UUID)' })
  @ApiResponse({ status: 200, description: '更新成功', type: Vehicle })
  @ApiResponse({ status: 404, description: '车辆不存在' })
  @ApiResponse({ status: 409, description: '车牌号冲突' })
  update(
    @Param('id') id: string,
    @Body() updateVehicleDto: UpdateVehicleDto,
    @Req() req: Request,
  ): Promise<Vehicle> {
    const user = req['user'];
    return this.vehicleService.update(id, updateVehicleDto, user);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除车辆备案记录', description: '根据ID删除车辆备案记录' })
  @ApiParam({ name: 'id', description: '车辆ID(UUID)' })
  @ApiResponse({ status: 204, description: '删除成功' })
  @ApiResponse({ status: 404, description: '车辆不存在' })
  remove(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req['user'];
    return this.vehicleService.remove(id, user);
  }
}
