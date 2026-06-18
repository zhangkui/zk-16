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
  UseGuards,
  Req,
  ForbiddenException,
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
import { CompanyService } from './company.service';
import { Company, CompanyStatus } from './company.entity';
import { User, UserRole } from '../auth/user.entity';
import {
  CreateCompanyDto,
  UpdateCompanyDto,
  QueryCompanyDto,
  CreateCompanyUserDto,
} from './company.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('公司管理')
@Controller('companies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  private isAdmin(user: any): boolean {
    return user.role === UserRole.ADMIN;
  }

  private isCompanyAdmin(user: any): boolean {
    return (
      user.role === UserRole.COMPANY_SUPER_ADMIN ||
      user.role === UserRole.COMPANY_ADMIN
    );
  }

  @Post()
  @ApiOperation({ summary: '创建公司', description: '超级管理员创建新公司，同时创建公司超级管理员账号' })
  @ApiResponse({ status: 201, description: '创建成功' })
  @ApiResponse({ status: 409, description: '公司名称或用户名已存在' })
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() createCompanyDto: CreateCompanyDto,
    @Req() req: Request,
  ): Promise<{ company: Company; adminUser: User }> {
    const user = req['user'];
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('只有超级管理员才能创建公司');
    }
    return this.companyService.create(createCompanyDto);
  }

  @Get()
  @ApiOperation({ summary: '分页查询公司列表' })
  @ApiResponse({ status: 200, description: '查询成功' })
  findAll(
    @Query() queryCompanyDto: QueryCompanyDto,
    @Req() req: Request,
  ): Promise<{ list: Company[]; total: number; page: number; pageSize: number }> {
    const user = req['user'];
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('只有超级管理员才能查看公司列表');
    }
    return this.companyService.findAll(queryCompanyDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '根据ID查询公司详情' })
  @ApiParam({ name: 'id', description: '公司ID(UUID)' })
  @ApiResponse({ status: 200, description: '查询成功', type: Company })
  @ApiResponse({ status: 404, description: '公司不存在' })
  findOne(@Param('id') id: string, @Req() req: Request): Promise<Company> {
    const user = req['user'];
    if (!this.isAdmin(user) && user.companyId !== id) {
      throw new ForbiddenException('无权访问该公司信息');
    }
    return this.companyService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新公司信息' })
  @ApiParam({ name: 'id', description: '公司ID(UUID)' })
  @ApiResponse({ status: 200, description: '更新成功', type: Company })
  @ApiResponse({ status: 404, description: '公司不存在' })
  @ApiResponse({ status: 409, description: '公司名称冲突' })
  update(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @Req() req: Request,
  ): Promise<Company> {
    const user = req['user'];
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('只有超级管理员才能更新公司信息');
    }
    return this.companyService.update(id, updateCompanyDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除公司' })
  @ApiParam({ name: 'id', description: '公司ID(UUID)' })
  @ApiResponse({ status: 204, description: '删除成功' })
  @ApiResponse({ status: 400, description: '公司下有用户，无法删除' })
  @ApiResponse({ status: 404, description: '公司不存在' })
  remove(@Param('id') id: string, @Req() req: Request): Promise<void> {
    const user = req['user'];
    if (!this.isAdmin(user)) {
      throw new ForbiddenException('只有超级管理员才能删除公司');
    }
    return this.companyService.remove(id);
  }

  @Get(':id/users')
  @ApiOperation({ summary: '获取公司用户列表' })
  @ApiParam({ name: 'id', description: '公司ID(UUID)' })
  @ApiQuery({ name: 'page', required: false, description: '页码', type: Number })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页条数', type: Number })
  @ApiResponse({ status: 200, description: '查询成功' })
  async getCompanyUsers(
    @Param('id') companyId: string,
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Req() req: Request,
  ): Promise<{ list: User[]; total: number; page: number; pageSize: number }> {
    const user = req['user'];
    if (!this.isAdmin(user) && user.companyId !== companyId) {
      throw new ForbiddenException('无权查看该公司的用户');
    }
    return this.companyService.getCompanyUsers(
      companyId,
      page ? +page : 1,
      pageSize ? +pageSize : 10,
    );
  }

  @Post(':id/users')
  @ApiOperation({ summary: '创建公司普通管理员' })
  @ApiParam({ name: 'id', description: '公司ID(UUID)' })
  @ApiResponse({ status: 201, description: '创建成功', type: User })
  @ApiResponse({ status: 409, description: '用户名已存在' })
  @HttpCode(HttpStatus.CREATED)
  async createCompanyUser(
    @Param('id') companyId: string,
    @Body() createCompanyUserDto: CreateCompanyUserDto,
    @Req() req: Request,
  ): Promise<User> {
    const user = req['user'];
    if (!this.isAdmin(user) && user.companyId !== companyId) {
      throw new ForbiddenException('无权为该公司创建用户');
    }
    if (!this.isAdmin(user) && user.role !== UserRole.COMPANY_SUPER_ADMIN) {
      throw new ForbiddenException('只有超级管理员或公司超级管理员才能创建公司用户');
    }
    return this.companyService.createCompanyUser(companyId, createCompanyUserDto);
  }

  @Delete(':id/users/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: '删除公司用户' })
  @ApiParam({ name: 'id', description: '公司ID(UUID)' })
  @ApiParam({ name: 'userId', description: '用户ID(UUID)' })
  @ApiResponse({ status: 204, description: '删除成功' })
  @ApiResponse({ status: 400, description: '公司超级管理员不能被删除' })
  @ApiResponse({ status: 403, description: '无权删除' })
  @ApiResponse({ status: 404, description: '用户不存在' })
  async deleteCompanyUser(
    @Param('id') companyId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ): Promise<void> {
    const user = req['user'];
    if (!this.isAdmin(user) && user.companyId !== companyId) {
      throw new ForbiddenException('无权删除该公司的用户');
    }
    if (!this.isAdmin(user) && user.role !== UserRole.COMPANY_SUPER_ADMIN) {
      throw new ForbiddenException('只有超级管理员或公司超级管理员才能删除用户');
    }
    return this.companyService.deleteCompanyUser(companyId, userId);
  }
}
