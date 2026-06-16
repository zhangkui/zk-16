import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';

export const JWT_SECRET = 'waste-transport-secret-key-2024';
export const JWT_EXPIRES_IN = '24h';
export const JWT_EXPIRES_IN_SECONDS = 24 * 60 * 60;

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const url = request.url || '';

    if (
      url.startsWith('/api/docs') ||
      url.startsWith('/api/docs-json') ||
      url.startsWith('/api/docs-yaml') ||
      url.startsWith('/docs') ||
      url.startsWith('/swagger')
    ) {
      return true;
    }

    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('未提供有效的认证令牌');
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      request['user'] = decoded;
      return true;
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('认证令牌已过期');
      }
      throw new UnauthorizedException('无效的认证令牌');
    }
  }
}
