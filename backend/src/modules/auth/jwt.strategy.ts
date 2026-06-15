import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { JWT_SECRET } from './jwt-auth.guard';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserStatus } from './user.entity';

@Injectable()
export class JwtStrategy {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async validate(payload: any): Promise<User> {
    const { id } = payload;
    const user = await this.userRepository.findOne({ where: { id } });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('用户账号已被禁用');
    }

    return user;
  }

  async validateToken(token: string): Promise<User> {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      return this.validate(payload);
    } catch (error) {
      throw new UnauthorizedException('无效的认证令牌');
    }
  }
}
