import { IncomingMessage } from 'http';
import { randomUUID } from 'crypto';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
} from '@nestjs/websockets';
import { WebSocket } from 'ws';
import { AccessService } from '../access/access.service';
import { canEdit } from '../access/access.policy';
import { JwtPayload } from '../auth/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { CollabRoomsService, RoomClient } from './collab-rooms.service';

type JoinMessage = {
  type: 'join';
  documentId: string;
  token?: string;
  shareToken?: string;
};

type ClientMessage =
  | JoinMessage
  | { type: 'update'; update: string }
  | { type: 'cursor'; blockId: string; offset: number }
  | { type: 'cursor-clear' };

@WebSocketGateway({ path: '/collab' })
export class CollabGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(CollabGateway.name);
  private readonly clients = new Map<WebSocket, RoomClient>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly access: AccessService,
    private readonly rooms: CollabRoomsService,
    private readonly prisma: PrismaService,
  ) {}

  handleConnection(socket: WebSocket, request: IncomingMessage): void {
    socket.on('message', (raw) => {
      void this.onMessage(socket, raw.toString());
    });
    const url = new URL(request.url ?? '/', 'http://localhost');
    const token = url.searchParams.get('token') ?? undefined;
    const shareToken = url.searchParams.get('shareToken') ?? undefined;
    const documentId = url.searchParams.get('documentId');
    if (documentId && (token || shareToken)) {
      void this.join(socket, {
        type: 'join',
        documentId,
        token,
        shareToken,
      });
    }
  }

  handleDisconnect(socket: WebSocket): void {
    this.leave(socket);
  }

  private async onMessage(socket: WebSocket, raw: string): Promise<void> {
    let message: ClientMessage;
    try {
      message = JSON.parse(raw) as ClientMessage;
    } catch {
      socket.send(JSON.stringify({ type: 'error', message: 'Invalid JSON' }));
      return;
    }
    if (message.type === 'join') {
      await this.join(socket, message);
      return;
    }
    const client = this.clients.get(socket);
    if (!client) {
      socket.send(JSON.stringify({ type: 'error', message: 'Join first' }));
      return;
    }
    const room = this.rooms.peek(client.documentId);
    if (!room) {
      socket.send(
        JSON.stringify({
          type: 'document_deleted',
          documentId: client.documentId,
        }),
      );
      socket.close(4404, 'Document deleted');
      this.clients.delete(socket);
      return;
    }
    if (message.type === 'update') {
      this.rooms.applyClientUpdate(room, client, message.update);
      return;
    }
    if (message.type === 'cursor') {
      this.rooms.setCursor(room, client, {
        blockId: message.blockId,
        offset: message.offset,
      });
      return;
    }
    if (message.type === 'cursor-clear') {
      this.rooms.setCursor(room, client, null);
    }
  }

  private async join(socket: WebSocket, message: JoinMessage): Promise<void> {
    try {
      let userId: string;
      let displayName: string;

      if (message.token) {
        const payload = await this.jwt.verifyAsync<JwtPayload>(message.token, {
          secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        });
        const user = await this.prisma.user.findUnique({
          where: { id: payload.sub },
        });
        if (!user) {
          socket.close(4401, 'Unauthorized');
          return;
        }
        userId = user.id;
        displayName = user.displayName;
      } else if (message.shareToken) {
        userId = `guest:${randomUUID()}`;
        displayName = 'Guest';
      } else {
        socket.close(4401, 'Unauthorized');
        return;
      }

      const resolved = await this.access.assertDocumentView(message.documentId, {
        userId: message.token ? userId : null,
        shareToken: message.shareToken,
      });
      const room = await this.rooms.getRoom(message.documentId);
      const client: RoomClient = {
        socket,
        documentId: message.documentId,
        userId,
        displayName,
        canEdit: canEdit(resolved.level),
        color: this.rooms.nextColor(room),
      };
      this.clients.set(socket, client);
      this.rooms.addClient(room, client);
      socket.send(
        JSON.stringify({
          type: 'sync',
          update: this.rooms.encodeState(room),
          canEdit: client.canEdit,
        }),
      );
    } catch (error) {
      this.logger.warn(`Collab join failed: ${String(error)}`);
      socket.close(4401, 'Unauthorized');
    }
  }

  private leave(socket: WebSocket): void {
    const client = this.clients.get(socket);
    if (!client) {
      return;
    }
    this.clients.delete(socket);
    const room = this.rooms.peek(client.documentId);
    if (room) {
      this.rooms.removeClient(room, client);
    }
  }
}
