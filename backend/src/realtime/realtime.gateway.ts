import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { OnEvent } from '@nestjs/event-emitter';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import * as jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../modules/auth/jwt-auth.guard';
import { UserRole } from '../modules/auth/user.entity';

export const REALTIME_ROOM_ALL = 'monitor:all';
export const companyRoom = (companyId: string) => `monitor:company:${companyId}`;

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  transports: ['websocket', 'polling'],
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger('RealtimeGateway');

  @WebSocketServer()
  server: Server;

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth as any)?.token ||
        (client.handshake.query as any)?.token ||
        (client.handshake.headers as any)?.authorization;

      const rawToken = Array.isArray(token) ? token[0] : token;
      const jwtToken =
        typeof rawToken === 'string' && rawToken.startsWith('Bearer ')
          ? rawToken.slice(7)
          : rawToken;

      if (!jwtToken) {
        this.logger.warn(`Connection rejected: no token (id=${client.id})`);
        client.disconnect(true);
        return;
      }

      const payload = jwt.verify(jwtToken, JWT_SECRET) as {
        id: string;
        username?: string;
        role: UserRole;
        companyId?: string;
        isCompanySuperAdmin?: boolean;
      };

      const isCompanyAdminRole =
        payload.role === UserRole.COMPANY_SUPER_ADMIN ||
        payload.role === UserRole.COMPANY_ADMIN;

      if (isCompanyAdminRole && payload.companyId) {
        client.join(companyRoom(payload.companyId));
      } else {
        client.join(REALTIME_ROOM_ALL);
      }

      client.data.user = payload;
      this.logger.log(
        `WS connected: ${payload.username || payload.id} (${payload.role}) -> rooms [${Array.from(client.rooms).join(', ')}]`,
      );
    } catch (error: any) {
      this.logger.warn(`Connection rejected: ${error.message} (id=${client.id})`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    const user = client.data?.user;
    this.logger.log(
      `WS disconnected: ${user?.username || user?.id || client.id}`,
    );
  }

  @OnEvent('track.point.created')
  handleTrackPointCreated(payload: any): void {
    if (!this.server) return;

    const message = {
      event: 'vehicle:position',
      ...payload,
    };

    this.server.to(REALTIME_ROOM_ALL).emit('vehicle:position', message);

    if (payload?.companyId) {
      this.server
        .to(companyRoom(payload.companyId))
        .emit('vehicle:position', message);
    }
  }
}
