import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { User, UserRole, UserStatus } from './user.entity';
import { LoginDto, RegisterDto, UpdateUserDto, LoginResponseDto } from './auth.dto';
import { JWT_SECRET, JWT_EXPIRES_IN, JWT_EXPIRES_IN_SECONDS } from './jwt-auth.guard';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const { username, password } = loginDto;

    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('用户账号已被禁用');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    user.lastLoginTime = new Date();
    await this.userRepository.save(user);

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
        department: user.department,
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    return {
      accessToken: token,
      expiresIn: JWT_EXPIRES_IN_SECONDS,
      user: {
        id: user.id,
        username: user.username,
        realName: user.realName,
        role: user.role,
        department: user.department,
        phone: user.phone,
        email: user.email,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<User> {
    const { username, password, realName, role, department, phone, email } = registerDto;

    const existingUser = await this.userRepository.findOne({ where: { username } });
    if (existingUser) {
      throw new ConflictException('用户名已存在');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = this.userRepository.create({
      username,
      password: hashedPassword,
      realName,
      role,
      department,
      phone,
      email,
      status: UserStatus.ACTIVE,
    });

    const savedUser = await this.userRepository.save(user);
    delete savedUser.password;
    return savedUser;
  }

  async getUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    delete user.password;
    return user;
  }

  async getUserByUsername(username: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { username } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }
    delete user.password;
    return user;
  }

  async findAll(
    page: number = 1,
    pageSize: number = 10,
    role?: UserRole,
    status?: UserStatus,
    keyword?: string,
  ): Promise<{ list: User[]; total: number; page: number; pageSize: number }> {
    const queryBuilder = this.userRepository.createQueryBuilder('user');

    if (role) {
      queryBuilder.andWhere('user.role = :role', { role });
    }

    if (status) {
      queryBuilder.andWhere('user.status = :status', { status });
    }

    if (keyword) {
      queryBuilder.andWhere(
        '(user.username LIKE :keyword OR user.realName LIKE :keyword OR user.department LIKE :keyword)',
        { keyword: `%${keyword}%` },
      );
    }

    queryBuilder.orderBy('user.createdAt', 'DESC');
    queryBuilder.skip((page - 1) * pageSize);
    queryBuilder.take(pageSize);

    const [list, total] = await queryBuilder.getManyAndCount();
    list.forEach((user) => delete user.password);

    return { list, total, page, pageSize };
  }

  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    if (updateUserDto.password) {
      updateUserDto.password = await bcrypt.hash(updateUserDto.password, 10);
    }

    Object.assign(user, updateUserDto);
    const updatedUser = await this.userRepository.save(user);
    delete updatedUser.password;
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    const result = await this.userRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException('用户不存在');
    }
  }
}
