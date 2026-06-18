import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EvidenceService } from './evidence.service';
import {
  CreateEvidenceDto,
  QueryEvidenceDto,
  FixEvidenceDto,
  VerifyEvidenceDto,
} from './evidence.dto';
import { Evidence } from './evidence.entity';

@ApiTags('证据管理')
@ApiBearerAuth()
@Controller('evidences')
@UseGuards(JwtAuthGuard)
export class EvidenceController {
  constructor(private readonly evidenceService: EvidenceService) {}

  @Post()
  @ApiOperation({ summary: '采集证据', description: '创建新的证据记录，状态默认为采集中(collecting)' })
  @ApiResponse({ status: 201, description: '创建成功', type: Evidence })
  @HttpCode(HttpStatus.CREATED)
  create(
    @Body() createEvidenceDto: CreateEvidenceDto,
    @Req() req: Request,
  ): Promise<Evidence> {
    const user = (req as any).user;
    return this.evidenceService.create(createEvidenceDto, user);
  }

  @Get()
  @ApiOperation({ summary: '分页查询证据列表', description: '支持告警ID、运输单ID、车牌号、类型、状态筛选，分页返回' })
  @ApiResponse({ status: 200, description: '查询成功' })
  findAll(
    @Query() queryEvidenceDto: QueryEvidenceDto,
    @Req() req: Request,
  ): Promise<{ data: Evidence[]; total: number; page: number; pageSize: number }> {
    const user = (req as any).user;
    return this.evidenceService.findAll(queryEvidenceDto, user);
  }

  @Get('alert/:alertId')
  @ApiOperation({ summary: '按告警ID查询证据列表', description: '根据告警ID查询关联的所有证据' })
  @ApiParam({ name: 'alertId', description: '告警ID(UUID)' })
  @ApiResponse({ status: 200, description: '查询成功', type: [Evidence] })
  getEvidencesByAlertId(
    @Param('alertId') alertId: string,
    @Req() req: Request,
  ): Promise<Evidence[]> {
    const user = (req as any).user;
    return this.evidenceService.getEvidencesByAlertId(alertId, user);
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID查询证据详情', description: '通过证据ID查询详细信息' })
  @ApiParam({ name: 'id', description: '证据ID(UUID)' })
  @ApiResponse({ status: 200, description: '查询成功', type: Evidence })
  @ApiResponse({ status: 404, description: '证据不存在' })
  findOne(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Evidence> {
    const user = (req as any).user;
    return this.evidenceService.findOne(id, user);
  }

  @Patch(':id/fix')
  @ApiOperation({ summary: '固化证据', description: '计算文件SHA256哈希，将证据状态设置为已固化(fixed)' })
  @ApiParam({ name: 'id', description: '证据ID(UUID)' })
  @ApiResponse({ status: 200, description: '固化成功', type: Evidence })
  @ApiResponse({ status: 400, description: '状态异常或文件不存在' })
  @ApiResponse({ status: 404, description: '证据不存在' })
  fixEvidence(
    @Param('id') id: string,
    @Body() fixEvidenceDto: FixEvidenceDto,
    @Req() req: Request,
  ): Promise<Evidence> {
    const user = (req as any).user;
    return this.evidenceService.fixEvidence(id, fixEvidenceDto, user);
  }

  @Patch(':id/verify')
  @ApiOperation({ summary: '审核证据', description: '将已固化的证据审核通过，状态设置为已审核(verified)' })
  @ApiParam({ name: 'id', description: '证据ID(UUID)' })
  @ApiResponse({ status: 200, description: '审核成功', type: Evidence })
  @ApiResponse({ status: 400, description: '状态异常' })
  @ApiResponse({ status: 404, description: '证据不存在' })
  verifyEvidence(
    @Param('id') id: string,
    @Body() verifyEvidenceDto: VerifyEvidenceDto,
    @Req() req: Request,
  ): Promise<Evidence> {
    const user = (req as any).user;
    return this.evidenceService.verifyEvidence(id, verifyEvidenceDto, user);
  }

  @Patch(':id/archive')
  @ApiOperation({ summary: '归档证据', description: '将已审核的证据归档，状态设置为已归档(archived)' })
  @ApiParam({ name: 'id', description: '证据ID(UUID)' })
  @ApiResponse({ status: 200, description: '归档成功', type: Evidence })
  @ApiResponse({ status: 400, description: '状态异常' })
  @ApiResponse({ status: 404, description: '证据不存在' })
  archiveEvidence(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<Evidence> {
    const user = (req as any).user;
    return this.evidenceService.archiveEvidence(id, user);
  }
}
