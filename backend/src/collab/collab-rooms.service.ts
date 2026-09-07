import { Injectable } from '@nestjs/common';
import * as Y from 'yjs';
import { AccessService } from '../access/access.service';
import { canEdit, canView } from '../access/access.policy';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../queue/outbox.service';
import { CollabPersistenceService } from './collab-persistence.service';
import {
  COLLAB_PERSISTENCE,
  shouldAutoSnapshot,
} from './collab-policy';
import { projectYDoc } from './project-ydoc';

type SocketLike = {
  send: (data: string) => void;
  close: (code?: number, reason?: string) => void;
  readyState: number;
};

export type RoomClient = {
  socket: SocketLike;
  documentId: string;
  workspaceId: string;
  userId: string;
  displayName: string;
  canEdit: boolean;
  color: string;
  shareToken?: string | null;
  cursor?: { blockId: string; offset: number } | null;
};

type Room = {
  documentId: string;
  workspaceId: string;
  ydoc: Y.Doc;
  clients: Set<RoomClient>;
  persistTimer?: NodeJS.Timeout;
  lastSnapshotAt: number;
  updatesSinceSnapshot: number;
  applying: boolean;
  closed: boolean;
};

const COLORS = [
  '#e11d48',
  '#2563eb',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#db2777',
];

@Injectable()
export class CollabRoomsService {
  private readonly rooms = new Map<string, Room>();

  constructor(
    private readonly persistence: CollabPersistenceService,
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly access: AccessService,
  ) {}

  async getRoom(documentId: string): Promise<Room> {
    const existing = this.rooms.get(documentId);
    if (existing && !existing.closed) {
      return existing;
    }
    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
      select: { id: true, workspaceId: true },
    });
    if (!document) {
      throw new Error('Document not found');
    }
    const ydoc = await this.persistence.loadDoc(documentId);
    const room: Room = {
      documentId,
      workspaceId: document.workspaceId,
      ydoc,
      clients: new Set(),
      applying: false,
      closed: false,
      lastSnapshotAt: Date.now(),
      updatesSinceSnapshot: 0,
    };
    this.attachUpdateHandler(room);
    this.rooms.set(documentId, room);
    return room;
  }

  peek(documentId: string): Room | undefined {
    const room = this.rooms.get(documentId);
    if (!room || room.closed) {
      return undefined;
    }
    return room;
  }

  addClient(room: Room, client: RoomClient): void {
    if (room.closed) {
      client.socket.send(
        JSON.stringify({
          type: 'document_deleted',
          documentId: room.documentId,
        }),
      );
      client.socket.close(4404, 'Document deleted');
      return;
    }
    room.clients.add(client);
    this.broadcastPresence(room);
  }

  removeClient(room: Room, client: RoomClient): void {
    room.clients.delete(client);
    if (room.closed) {
      return;
    }
    this.broadcastPresence(room);
    if (room.clients.size === 0) {
      this.schedulePersist(room, 0);
    }
  }

  applyClientUpdate(room: Room, client: RoomClient, updateB64: string): void {
    if (room.closed) {
      client.socket.send(
        JSON.stringify({
          type: 'document_deleted',
          documentId: room.documentId,
        }),
      );
      client.socket.close(4404, 'Document deleted');
      return;
    }
    if (!client.canEdit) {
      client.socket.send(
        JSON.stringify({
          type: 'error',
          code: 'FORBIDDEN',
          message: 'Edit access required',
        }),
      );
      return;
    }
    const update = Buffer.from(updateB64, 'base64');
    room.applying = true;
    Y.applyUpdate(room.ydoc, new Uint8Array(update), client);
    room.applying = false;
  }

  encodeState(room: Room): string {
    return Buffer.from(Y.encodeStateAsUpdate(room.ydoc)).toString('base64');
  }

  setCursor(
    room: Room,
    client: RoomClient,
    cursor: { blockId: string; offset: number } | null,
  ): void {
    if (room.closed) {
      return;
    }
    client.cursor = cursor;
    this.broadcastPresence(room);
  }

  async reload(documentId: string): Promise<void> {
    const room = this.rooms.get(documentId);
    if (!room || room.closed) {
      return;
    }
    const ydoc = await this.persistence.loadDoc(documentId);
    room.ydoc.destroy();
    room.ydoc = ydoc;
    room.updatesSinceSnapshot = 0;
    room.lastSnapshotAt = Date.now();
    this.attachUpdateHandler(room);
    this.broadcast(room, { type: 'sync', update: this.encodeState(room) });
  }

  /**
   * Force-flush live (or cold) CRDT state into DocumentProjection.
   * Used before publish so public SSR/ISR does not miss in-flight editor edits
   * that sat in the debounce window.
   */
  async flushProjection(documentId: string): Promise<void> {
    const room = this.rooms.get(documentId);
    if (room && !room.closed) {
      if (room.persistTimer) {
        clearTimeout(room.persistTimer);
        room.persistTimer = undefined;
      }
      await this.flush(room);
      return;
    }

    const document = await this.prisma.document.findFirst({
      where: { id: documentId, deletedAt: null },
    });
    if (!document) {
      return;
    }

    const ydoc = await this.persistence.loadDoc(documentId);
    const projected = projectYDoc(ydoc);
    ydoc.destroy();

    await this.prisma.document.update({
      where: { id: documentId },
      data: { title: projected.title },
    });
    await this.prisma.documentProjection.upsert({
      where: { documentId },
      update: {
        title: projected.title,
        description: projected.description,
        blocksJson: projected.blocks,
        plainText: projected.plainText,
        projectedAt: new Date(),
      },
      create: {
        documentId,
        title: projected.title,
        description: projected.description,
        blocksJson: projected.blocks,
        plainText: projected.plainText,
      },
    });
  }

  /**
   * Soft-delete while editors are connected: notify, close sockets, drop room.
   */
  closeDeleted(documentId: string): void {
    const room = this.rooms.get(documentId);
    if (!room) {
      return;
    }
    room.closed = true;
    if (room.persistTimer) {
      clearTimeout(room.persistTimer);
      room.persistTimer = undefined;
    }
    const payload = JSON.stringify({
      type: 'document_deleted',
      documentId,
    });
    for (const client of room.clients) {
      if (client.socket.readyState === 1) {
        client.socket.send(payload);
      }
      try {
        client.socket.close(4404, 'Document deleted');
      } catch {
        // ignore already-closed sockets
      }
    }
    room.clients.clear();
    room.ydoc.destroy();
    this.rooms.delete(documentId);
  }

  /** @deprecated use closeDeleted for soft-delete edge case */
  close(documentId: string, reason = 'Document closed'): void {
    if (reason === 'Document deleted') {
      this.closeDeleted(documentId);
      return;
    }
    const room = this.rooms.get(documentId);
    if (!room) {
      return;
    }
    room.closed = true;
    this.broadcast(room, { type: 'closed', message: reason });
    for (const client of room.clients) {
      try {
        client.socket.close(1000, reason);
      } catch {
        // ignore
      }
    }
    room.clients.clear();
    room.ydoc.destroy();
    this.rooms.delete(documentId);
  }

  nextColor(room: Room): string {
    return COLORS[room.clients.size % COLORS.length];
  }

  kickClient(
    room: Room,
    client: RoomClient,
    reason = 'access_revoked',
  ): void {
    room.clients.delete(client);
    const payload = JSON.stringify({
      type: 'access_revoked',
      reason,
      documentId: room.documentId,
    });
    if (client.socket.readyState === 1) {
      try {
        client.socket.send(payload);
      } catch {
        // ignore
      }
    }
    try {
      client.socket.close(4403, reason);
    } catch {
      // ignore
    }
    if (!room.closed) {
      this.broadcastPresence(room);
      if (room.clients.size === 0) {
        this.schedulePersist(room, 0);
      }
    }
  }

  /**
   * Drop live collab sessions for a user across a workspace (member removed).
   */
  kickUserFromWorkspace(workspaceId: string, userId: string): void {
    for (const room of this.rooms.values()) {
      if (room.closed || room.workspaceId !== workspaceId) {
        continue;
      }
      for (const client of [...room.clients]) {
        if (client.userId === userId) {
          this.kickClient(room, client, 'workspace_membership_revoked');
        }
      }
    }
  }

  /**
   * Re-check ACL for one user on every open room in a workspace (role change).
   */
  async revalidateUserInWorkspace(
    workspaceId: string,
    userId: string,
  ): Promise<void> {
    for (const room of this.rooms.values()) {
      if (room.closed || room.workspaceId !== workspaceId) {
        continue;
      }
      for (const client of [...room.clients]) {
        if (client.userId === userId) {
          await this.revalidateClient(room, client);
        }
      }
    }
  }

  async revalidateUserOnDocument(
    documentId: string,
    userId: string,
  ): Promise<void> {
    const room = this.peek(documentId);
    if (!room) {
      return;
    }
    for (const client of [...room.clients]) {
      if (client.userId === userId) {
        await this.revalidateClient(room, client);
      }
    }
  }

  async revalidateAllClientsOnDocument(documentId: string): Promise<void> {
    const room = this.peek(documentId);
    if (!room) {
      return;
    }
    for (const client of [...room.clients]) {
      await this.revalidateClient(room, client);
    }
  }

  async revalidateClient(
    room: Room,
    client: RoomClient,
  ): Promise<'ok' | 'kicked'> {
    const userId = client.userId.startsWith('guest:') ? null : client.userId;
    try {
      const { level } = await this.access.resolveDocument(client.documentId, {
        userId,
        shareToken: client.shareToken,
      });
      if (!canView(level)) {
        this.kickClient(room, client, 'access_revoked');
        return 'kicked';
      }
      const edit = canEdit(level);
      if (client.canEdit !== edit) {
        client.canEdit = edit;
        if (client.socket.readyState === 1) {
          client.socket.send(
            JSON.stringify({ type: 'access', canEdit: edit }),
          );
        }
      }
      return 'ok';
    } catch {
      this.kickClient(room, client, 'access_revoked');
      return 'kicked';
    }
  }

  private attachUpdateHandler(room: Room): void {
    room.ydoc.on('update', (update: Uint8Array, origin: unknown) => {
      if (room.closed || origin === 'remote' || origin === 'load') {
        return;
      }
      // Replay of the same payload is ignored by unique(hash); do not bump counters.
      void this.persistence.applyUpdate(room.documentId, update).then((result) => {
        if (!result.applied || room.closed) {
          return;
        }
        room.updatesSinceSnapshot += 1;
        this.schedulePersist(room);
      });
      this.broadcast(
        room,
        { type: 'update', update: Buffer.from(update).toString('base64') },
        origin as RoomClient | undefined,
      );
    });
  }

  private broadcast(
    room: Room,
    message: Record<string, unknown>,
    except?: RoomClient,
  ): void {
    const payload = JSON.stringify(message);
    for (const client of room.clients) {
      if (client === except) {
        continue;
      }
      if (client.socket.readyState === 1) {
        client.socket.send(payload);
      }
    }
  }

  private broadcastPresence(room: Room): void {
    this.broadcast(room, {
      type: 'presence',
      users: [...room.clients].map((client) => ({
        userId: client.userId,
        displayName: client.displayName,
        color: client.color,
        cursor: client.cursor ?? null,
      })),
    });
  }

  private schedulePersist(room: Room, delay: number = COLLAB_PERSISTENCE.FLUSH_DEBOUNCE_MS): void {
    if (room.closed) {
      return;
    }
    if (room.persistTimer) {
      clearTimeout(room.persistTimer);
    }
    room.persistTimer = setTimeout(() => {
      void this.flush(room);
    }, delay);
  }

  private async flush(room: Room): Promise<void> {
    if (room.closed || !this.rooms.has(room.documentId)) {
      return;
    }

    await this.persistence.compact(room.documentId);
    const projected = projectYDoc(room.ydoc);

    if (
      shouldAutoSnapshot({
        updatesSinceSnapshot: room.updatesSinceSnapshot,
        lastSnapshotAt: room.lastSnapshotAt,
      })
    ) {
      await this.persistence.snapshot(
        room.documentId,
        projected.title,
        'AUTO',
      );
      room.lastSnapshotAt = Date.now();
      room.updatesSinceSnapshot = 0;
    }

    if (room.closed || !this.rooms.has(room.documentId)) {
      return;
    }

    const document = await this.prisma.document.findFirst({
      where: { id: room.documentId, deletedAt: null },
    });
    if (!document) {
      this.closeDeleted(room.documentId);
      return;
    }

    await this.prisma.document.update({
      where: { id: room.documentId },
      data: { title: projected.title },
    });
    await this.prisma.documentProjection.upsert({
      where: { documentId: room.documentId },
      update: {
        title: projected.title,
        description: projected.description,
        blocksJson: projected.blocks,
        plainText: projected.plainText,
        projectedAt: new Date(),
      },
      create: {
        documentId: room.documentId,
        title: projected.title,
        description: projected.description,
        blocksJson: projected.blocks,
        plainText: projected.plainText,
      },
    });
    await this.outbox.enqueue({
      type: 'search.index',
      aggregateType: 'document',
      aggregateId: room.documentId,
      idempotencyKey: `search:collab:${room.documentId}:${Date.now()}`,
      payload: {
        documentId: room.documentId,
        workspaceId: document.workspaceId,
      },
    });
    await this.outbox.enqueue({
      type: 'page.revalidate',
      aggregateType: 'document',
      aggregateId: room.documentId,
      idempotencyKey: `revalidate:collab:${room.documentId}:${Date.now()}`,
      payload: {
        slug:
          document.publicationStatus === 'PUBLISHED'
            ? document.publicSlug ?? undefined
            : undefined,
        documentId: room.documentId,
        tag: `workspace-tree:${document.workspaceId}`,
        path: `/app/w/${document.workspaceId}`,
      },
    });
  }
}
