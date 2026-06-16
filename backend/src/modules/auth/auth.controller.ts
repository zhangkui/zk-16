import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { Request } from 'express';
import { AuthService } from './auth.service';
import {
  LoginDto,
  RegisterDto,
  UpdateUserDto,
  LoginResponseDto,
} from './auth.dto';
import { User, UserRole, UserStatus } from './user.entity';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';

@ApiTags('认证管理')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @Public()
  @ApiOperation({ summary: '用户登录' })
  @ApiResponse({ status: 200, description: '登录成功', type: LoginResponseDto })
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('register')
  @Public()
  @ApiOperation({ summary: '用户注册' })
  @ApiResponse({ status: 201, description: '注册成功', type: User })
  async register(@Body() registerDto: RegisterDto): Promise<User> {
    return this.authService.register(registerDto);
  }

  @Get('profile')
  @ApiOperation({ summary: '获取当前用户信息' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '获取成功', type: User })
  @UseGuards(JwtAuthGuard)
  async getProfile(@Req() req: Request): Promise<User> {
    const user = req['user'];
    return this.authService.getUserById(user.id);
  }

  @Get('users')
  @ApiOperation({ summary: '获取用户列表' })
  @ApiBearerAuth()
  @ApiQuery({ name: 'page', required: false, description: '页码', type: Number })
  @ApiQuery({ name: 'pageSize', required: false, description: '每页条数', type: Number })
  @ApiQuery({ name: 'role', required: false, enum: UserRole, description: '角色筛选' })
  @ApiQuery({ name: 'status', required: false, enum: UserStatus, description: '状态筛选' })
  @ApiQuery({ name: 'keyword', required: false, description: '搜索关键词' })
  @ApiResponse({ status: 200, description: '获取成功' })
  @UseGuards(JwtAuthGuard)
  async findAll(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
    @Query('role') role?: UserRole,
    @Query('status') status?: UserStatus,
    @Query('keyword') keyword?: string,
  ): Promise<{ list: User[]; total: number; page: number; pageSize: number }> {
    return this.authService.findAll(
      page ? +page : 1,
      pageSize ? +pageSize : 10,
      role,
      status,
      keyword,
    );
  }

  @Get('users/:id')
  @ApiOperation({ summary: '获取单个用户信息' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '获取成功', type: User })
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string): Promise<User> {
    return this.authService.getUserById(id);
  }

  @Put('users/:id')
  @ApiOperation({ summary: '更新用户信息' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: '更新成功', type: User })
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @Body() updateUserDto: UpdateUserDto,
  ): Promise<User> {
    return this.authService.updateUser(id, updateUserDto);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: '删除用户' })
  @ApiBearerAuth()
  @ApiResponse({ status: 204, description: '删除成功' })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string): Promise<void> {
    return this.authService.deleteUser(id);
  }
}
