import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

type MentionPayload = {
  threadId: string;
  authorId: string;
  names: string[];
};

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<MentionPayload>): Promise<void> {
    if (job.name !== 'notification.mention') {
      this.logger.debug(`Skip notification job ${job.name}`);
      return;
    }

    const { threadId, authorId, names } = job.data;
    if (!names?.length) {
      return;
    }

    const thread = await this.prisma.commentThread.findUnique({
      where: { id: threadId },
      select: {
        id: true,
        documentId: true,
        blockId: true,
        document: { select: { workspaceId: true } },
      },
    });
    if (!thread) {
      return;
    }

    const uniqueNames = [...new Set(names.map((n) => n.toLowerCase()))];
    const users = await this.prisma.user.findMany({
      where: {
        OR: uniqueNames.flatMap((name) => [
          { displayName: { equals: name, mode: 'insensitive' } },
          { email: { startsWith: `${name}@`, mode: 'insensitive' } },
          { email: { equals: name, mode: 'insensitive' } },
        ]),
      },
      select: { id: true },
    });

    for (const user of users) {
      if (user.id === authorId) {
        continue;
      }
      const eventId = `mention:${threadId}:${user.id}:${job.id ?? job.timestamp}`;
      try {
        await this.prisma.notification.create({
          data: {
            userId: user.id,
            eventId,
            type: NotificationType.MENTION,
            payload: {
              threadId,
              documentId: thread.documentId,
              workspaceId: thread.document.workspaceId,
              blockId: thread.blockId,
              authorId,
            } as Prisma.InputJsonValue,
          },
        });
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2002'
        ) {
          continue;
        }
        throw error;
      }
    }
  }
}
