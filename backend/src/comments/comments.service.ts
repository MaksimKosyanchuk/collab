import { Injectable, NotFoundException } from '@nestjs/common';
import { AccessService, AccessContext } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../queue/outbox.service';

const MENTION_RE = /@([a-zA-Z0-9._-]+)/g;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly outbox: OutboxService,
  ) {}

  async list(documentId: string, ctx: AccessContext) {
    await this.access.assertDocumentView(documentId, ctx);
    return this.prisma.commentThread.findMany({
      where: { documentId },
      include: {
        comments: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { id: true, displayName: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createThread(
    documentId: string,
    userId: string,
    blockId: string,
    body: string,
  ) {
    await this.access.assertDocumentEdit(documentId, { userId });
    const thread = await this.prisma.commentThread.create({
      data: {
        documentId,
        blockId,
        createdById: userId,
        comments: {
          create: { authorId: userId, body },
        },
      },
      include: { comments: true },
    });
    await this.enqueueMentions(thread.id, userId, body);
    return thread;
  }

  async addComment(threadId: string, userId: string, body: string) {
    const thread = await this.prisma.commentThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }
    await this.access.assertDocumentEdit(thread.documentId, { userId });
    const comment = await this.prisma.comment.create({
      data: { threadId, authorId: userId, body },
    });
    await this.enqueueMentions(threadId, userId, body);
    return comment;
  }

  async resolve(threadId: string, userId: string, resolved = true) {
    const thread = await this.prisma.commentThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) {
      throw new NotFoundException('Thread not found');
    }
    await this.access.assertDocumentEdit(thread.documentId, { userId });
    return this.prisma.commentThread.update({
      where: { id: threadId },
      data: { resolvedAt: resolved ? new Date() : null },
    });
  }

  private async enqueueMentions(
    threadId: string,
    authorId: string,
    body: string,
  ) {
    const names = [...body.matchAll(MENTION_RE)].map((match) => match[1]);
    if (names.length === 0) {
      return;
    }
    await this.outbox.enqueue({
      type: 'notification.mention',
      aggregateType: 'comment_thread',
      aggregateId: threadId,
      idempotencyKey: `mention:${threadId}:${body.slice(0, 32)}:${Date.now()}`,
      payload: { threadId, authorId, names },
    });
  }
}
