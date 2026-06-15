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
} from '@nestjs/swagger';
import { DisposalReceiptService } from './disposal-receipt.service';
import {
  CreateDisposalReceiptDto,
  UpdateDisposalReceiptDto,
  QueryDisposalReceiptDto,
  MatchReceiptDto,
} from './disposal-receipt.dto';
import { DisposalReceipt } from './disposal-receipt.entity';

@ApiTags('处置联单管理')
@Controller('disposal-receipts')
export class DisposalReceiptController {
  constructor(private readonly disposalReceiptService: DisposalReceiptService) {}

  @Post()
  @ApiOperation({ summary: '创建处置联单', description: '创建新的处置联单，状态默认为待匹配(pending)' })
  @ApiResponse({ status: 201, description: '创建成功', type: DisposalReceipt })
  @ApiResponse({ status: 409, description: '联单编号已存在' })
  @HttpCode(HttpStatus.CREATED)
  create(@Body() createDisposalReceiptDto: CreateDisposalReceiptDto): Promise<DisposalReceipt> {
    return this.disposalReceiptService.create(createDisposalReceiptDto);
  }

  @Get()
  @ApiOperation({ summary: '分页查询处置联单列表', description: '支持联单编号、车牌号、状态、垃圾种类、装载日期范围筛选，分页返回' })
  @ApiResponse({ status: 200, description: '查询成功' })
  findAll(
    @Query() queryDisposalReceiptDto: QueryDisposalReceiptDto,
  ): Promise<{ data: DisposalReceipt[]; total: number; page: number; pageSize: number }> {
    return this.disposalReceiptService.findAll(queryDisposalReceiptDto);
  }

  @Get('unmatched')
  @ApiOperation({ summary: '获取待匹配联单列表', description: '查询所有状态为待匹配(pending)的处置联单' })
  @ApiResponse({ status: 200, description: '查询成功', type: [DisposalReceipt] })
  getUnmatchedReceipts(): Promise<DisposalReceipt[]> {
    return this.disposalReceiptService.getUnmatchedReceipts();
  }

  @Get('statistics')
  @ApiOperation({ summary: '获取匹配统计', description: '统计联单总数、待匹配数、已匹配数、不匹配数、已过期数及匹配率' })
  @ApiResponse({ status: 200, description: '查询成功' })
  getMatchStatistics(): Promise<{
    total: number;
    pending: number;
    matched: number;
    mismatched: number;
    expired: number;
    matchRate: number;
  }> {
    return this.disposalReceiptService.getMatchStatistics();
  }

  @Get('receipt-no/:receiptNo')
  @ApiOperation({ summary: '根据联单编号查询', description: '通过联单编号精确查询处置联单信息' })
  @ApiParam({ name: 'receiptNo', description: '联单编号' })
  @ApiResponse({ status: 200, description: '查询成功', type: DisposalReceipt })
  @ApiResponse({ status: 404, description: '联单不存在' })
  findByReceiptNo(@Param('receiptNo') receiptNo: string): Promise<DisposalReceipt> {
    return this.disposalReceiptService.findByReceiptNo(receiptNo);
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID查询联单详情', description: '通过联单ID查询详细信息' })
  @ApiParam({ name: 'id', description: '联单ID(UUID)' })
  @ApiResponse({ status: 200, description: '查询成功', type: DisposalReceipt })
  @ApiResponse({ status: 404, description: '联单不存在' })
  findOne(@Param('id') id: string): Promise<DisposalReceipt> {
    return this.disposalReceiptService.findOne(id);
  }

  @Patch(':id/match')
  @ApiOperation({ summary: '匹配联单与运输单', description: '将处置联单与运输单进行匹配，比对车牌、垃圾类型、重量(±5%误差)、装载日期' })
  @ApiParam({ name: 'id', description: '联单ID(UUID)' })
  @ApiResponse({ status: 200, description: '匹配完成', type: DisposalReceipt })
  @ApiResponse({ status: 400, description: '联单已匹配或状态异常' })
  @ApiResponse({ status: 404, description: '联单或运输单不存在' })
  matchReceipt(
    @Param('id') id: string,
    @Body() matchReceiptDto: MatchReceiptDto,
  ): Promise<DisposalReceipt> {
    return this.disposalReceiptService.matchReceipt(id, matchReceiptDto);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新联单信息', description: '更新处置联单的基本信息' })
  @ApiParam({ name: 'id', description: '联单ID(UUID)' })
  @ApiResponse({ status: 200, description: '更新成功', type: DisposalReceipt })
  @ApiResponse({ status: 404, description: '联单不存在' })
  @ApiResponse({ status: 409, description: '联单编号冲突' })
  update(
    @Param('id') id: string,
    @Body() updateDisposalReceiptDto: UpdateDisposalReceiptDto,
  ): Promise<DisposalReceipt> {
    return this.disposalReceiptService.update(id, updateDisposalReceiptDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除联单', description: '根据ID删除处置联单' })
  @ApiParam({ name: 'id', description: '联单ID(UUID)' })
  @ApiResponse({ status: 204, description: '删除成功' })
  @ApiResponse({ status: 404, description: '联单不存在' })
  remove(@Param('id') id: string): Promise<void> {
    return this.disposalReceiptService.remove(id);
  }
}
