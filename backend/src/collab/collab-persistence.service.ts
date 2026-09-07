import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import * as Y from 'yjs';
import { PrismaService } from '../prisma/prisma.service';

const COMPACT_AFTER = 100;

function toBytes(data: Uint8Array): Uint8Array<ArrayBuffer> {
  const copy = new Uint8Array(data.byteLength);
  copy.set(data);
  return copy;
}

@Injectable()
export class CollabPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async initializeDocument(documentId: string, title: string): Promise<void> {
    const ydoc = new Y.Doc();
    ydoc.getMap('meta').set('title', title);
    ydoc.getArray('blocks');
    const state = toBytes(Y.encodeStateAsUpdate(ydoc));
    await this.prisma.documentCollabState.create({
      data: { documentId, state, updateCount: 0 },
    });
    ydoc.destroy();
  }

  async loadDoc(documentId: string): Promise<Y.Doc> {
    const ydoc = new Y.Doc();
    const stored = await this.prisma.documentCollabState.findUnique({
      where: { documentId },
    });
    if (stored) {
      Y.applyUpdate(ydoc, new Uint8Array(stored.state));
    }
    const updates = await this.prisma.documentCollabUpdate.findMany({
      where: { documentId },
      orderBy: { createdAt: 'asc' },
    });
    for (const update of updates) {
      Y.applyUpdate(ydoc, new Uint8Array(update.payload));
    }
    return ydoc;
  }

  async applyUpdate(
    documentId: string,
    payload: Uint8Array,
  ): Promise<{ applied: boolean }> {
    const bytes = toBytes(payload);
    const hash = createHash('sha256').update(bytes).digest('hex');
    try {
      await this.prisma.documentCollabUpdate.create({
        data: { documentId, payload: bytes, hash },
      });
    } catch {
      return { applied: false };
    }

    const count = await this.prisma.documentCollabUpdate.count({
      where: { documentId },
    });
    if (count >= COMPACT_AFTER) {
      await this.compact(documentId);
    }
    return { applied: true };
  }

  async compact(documentId: string): Promise<void> {
    const ydoc = await this.loadDoc(documentId);
    const state = toBytes(Y.encodeStateAsUpdate(ydoc));
    await this.prisma.$transaction([
      this.prisma.documentCollabState.upsert({
        where: { documentId },
        update: { state, updateCount: { increment: 1 }, compactedAt: new Date() },
        create: { documentId, state, updateCount: 1, compactedAt: new Date() },
      }),
      this.prisma.documentCollabUpdate.deleteMany({ where: { documentId } }),
    ]);
    ydoc.destroy();
  }

  async snapshot(
    documentId: string,
    title: string,
    trigger: 'AUTO' | 'MANUAL' | 'RESTORE',
    createdById?: string,
  ) {
    const ydoc = await this.loadDoc(documentId);
    const state = toBytes(Y.encodeStateAsUpdate(ydoc));
    ydoc.destroy();
    return this.prisma.documentVersion.create({
      data: { documentId, state, title, trigger, createdById },
    });
  }
}
