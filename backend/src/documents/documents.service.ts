import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PlanTier, PublicationStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import sanitizeHtml from 'sanitize-html';
import { AccessService, AccessContext, hashToken } from '../access/access.service';
import { canEdit } from '../access/access.policy';
import { CollabPersistenceService } from '../collab/collab-persistence.service';
import { PlanLimitException } from '../common/exceptions/plan-limit.exception';
import { nextRank, slugify } from '../common/ids';
import { PLAN_LIMITS } from '../common/plan-limits';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../queue/outbox.service';
import {
  CreateDocumentDto,
  CreatePublicLinkDto,
  MoveDocumentDto,
  ShareDocumentDto,
} from './dto/document.dto';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
    private readonly collab: CollabPersistenceService,
    private readonly outbox: OutboxService,
  ) {}

  async tree(workspaceId: string, userId: string) {
    await this.access.assertWorkspaceMember(workspaceId, userId);
    return this.prisma.document.findMany({
      where: { workspaceId, deletedAt: null },
      orderBy: [{ parentId: 'asc' }, { rank: 'asc' }],
      select: {
        id: true,
        parentId: true,
        title: true,
        rank: true,
        publicationStatus: true,
        updatedAt: true,
      },
    });
  }

  async create(
    workspaceId: string,
    userId: string,
    dto: CreateDocumentDto,
  ) {
    await this.access.assertWorkspaceMember(workspaceId, userId);
    const workspace = await this.prisma.workspace.findUniqueOrThrow({
      where: { id: workspaceId },
    });
    await this.assertDocumentLimit(workspaceId, workspace.plan);

    if (dto.parentId) {
      const parent = await this.prisma.document.findFirst({
        where: { id: dto.parentId, workspaceId, deletedAt: null },
      });
      if (!parent) {
        throw new BadRequestException('Parent document not found');
      }
    }

    const last = await this.prisma.document.findFirst({
      where: {
        workspaceId,
        parentId: dto.parentId ?? null,
        deletedAt: null,
      },
      orderBy: { rank: 'desc' },
    });
    const title = dto.title?.trim() || 'Untitled';
    const document = await this.prisma.document.create({
      data: {
        workspaceId,
        parentId: dto.parentId,
        title,
        rank: nextRank(last?.rank),
        createdById: userId,
      },
    });
    await this.collab.initializeDocument(document.id, title);
    await this.prisma.documentProjection.create({
      data: {
        documentId: document.id,
        title,
        description: '',
        blocksJson: [],
        plainText: '',
      },
    });
    await this.outbox.enqueue({
      type: 'search.index',
      aggregateType: 'document',
      aggregateId: document.id,
      idempotencyKey: `search:create:${document.id}`,
      payload: { documentId: document.id, workspaceId },
    });
    return document;
  }

  async get(documentId: string, ctx: AccessContext) {
    const { document, level } = await this.access.assertDocumentView(
      documentId,
      ctx,
    );
    const projection = await this.prisma.documentProjection.findUnique({
      where: { documentId },
    });
    return { ...document, access: level, projection };
  }

  async rename(documentId: string, ctx: AccessContext, title: string) {
    await this.access.assertDocumentEdit(documentId, ctx);
    const document = await this.prisma.document.update({
      where: { id: documentId },
      data: { title },
    });
    await this.enqueueIndex(document.workspaceId, document.id);
    return document;
  }

  async move(documentId: string, ctx: AccessContext, dto: MoveDocumentDto) {
    const { document } = await this.access.assertDocumentEdit(documentId, ctx);
    if (dto.parentId === documentId) {
      throw new BadRequestException('Document cannot be its own parent');
    }
    if (dto.parentId) {
      const parent = await this.prisma.document.findFirst({
        where: {
          id: dto.parentId,
          workspaceId: document.workspaceId,
          deletedAt: null,
        },
      });
      if (!parent) {
        throw new BadRequestException('Parent document not found');
      }
    }
    const last = await this.prisma.document.findFirst({
      where: {
        workspaceId: document.workspaceId,
        parentId: dto.parentId ?? null,
        deletedAt: null,
        NOT: { id: documentId },
      },
      orderBy: { rank: 'desc' },
    });
    return this.prisma.document.update({
      where: { id: documentId },
      data: {
        parentId: dto.parentId === undefined ? document.parentId : dto.parentId,
        rank: dto.rank ?? nextRank(last?.rank),
      },
    });
  }

  async remove(documentId: string, ctx: AccessContext) {
    await this.access.assertDocumentEdit(documentId, ctx);
    const document = await this.prisma.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() },
    });
    await this.outbox.enqueue({
      type: 'search.delete',
      aggregateType: 'document',
      aggregateId: document.id,
      idempotencyKey: `search:delete:${document.id}:${document.deletedAt?.toISOString()}`,
      payload: { documentId: document.id, workspaceId: document.workspaceId },
    });
    return document;
  }

  async publish(
    documentId: string,
    ctx: AccessContext,
    published: boolean,
  ) {
    const { document, level } = await this.access.assertDocumentEdit(
      documentId,
      ctx,
    );
    if (!canEdit(level)) {
      throw new BadRequestException('Cannot publish this document');
    }
    const publicSlug =
      published && !document.publicSlug
        ? slugify(document.title, randomBytes(4).toString('hex'))
        : document.publicSlug;
    const updated = await this.prisma.document.update({
      where: { id: documentId },
      data: {
        publicationStatus: published
          ? PublicationStatus.PUBLISHED
          : PublicationStatus.UNPUBLISHED,
        publicSlug: published ? publicSlug : document.publicSlug,
        publishedAt: published ? new Date() : document.publishedAt,
      },
    });
    await this.outbox.enqueue({
      type: 'page.revalidate',
      aggregateType: 'document',
      aggregateId: document.id,
      idempotencyKey: `revalidate:${document.id}:${updated.updatedAt.toISOString()}`,
      payload: { slug: updated.publicSlug, documentId },
    });
    return updated;
  }

  async getPublished(slug: string) {
    const document = await this.prisma.document.findFirst({
      where: {
        publicSlug: slug,
        publicationStatus: PublicationStatus.PUBLISHED,
        deletedAt: null,
      },
      include: { projection: true },
    });
    if (!document) {
      throw new NotFoundException('Published document not found');
    }
    const projection = document.projection;
    return {
      id: document.id,
      title: sanitizeHtml(projection?.title ?? document.title, {
        allowedTags: [],
      }),
      description: sanitizeHtml(projection?.description ?? '', {
        allowedTags: [],
      }),
      blocks: projection?.blocksJson ?? [],
      updatedAt: document.updatedAt,
    };
  }

  async share(documentId: string, ctx: AccessContext, dto: ShareDocumentDto) {
    await this.access.assertDocumentManage(documentId, ctx);
    if (dto.access === 'MANAGE') {
      throw new BadRequestException('MANAGE is reserved for workspace admins');
    }
    return this.prisma.documentShare.upsert({
      where: {
        documentId_userId: { documentId, userId: dto.userId },
      },
      update: { access: dto.access },
      create: {
        documentId,
        userId: dto.userId,
        access: dto.access,
      },
    });
  }

  async createPublicLink(
    documentId: string,
    ctx: AccessContext,
    userId: string,
    dto: CreatePublicLinkDto,
  ) {
    await this.access.assertDocumentManage(documentId, ctx);
    if (dto.access === 'MANAGE') {
      throw new BadRequestException('Public links cannot grant MANAGE');
    }
    const token = randomBytes(24).toString('base64url');
    const link = await this.prisma.documentPublicLink.create({
      data: {
        documentId,
        tokenHash: hashToken(token),
        tokenPrefix: token.slice(0, 8),
        access: dto.access,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        createdById: userId,
      },
    });
    return { id: link.id, token, access: link.access, expiresAt: link.expiresAt };
  }

  private async enqueueIndex(workspaceId: string, documentId: string) {
    await this.outbox.enqueue({
      type: 'search.index',
      aggregateType: 'document',
      aggregateId: documentId,
      idempotencyKey: `search:index:${documentId}:${Date.now()}`,
      payload: { documentId, workspaceId },
    });
  }

  private async assertDocumentLimit(workspaceId: string, plan: PlanTier) {
    const count = await this.prisma.document.count({
      where: { workspaceId, deletedAt: null },
    });
    if (count >= PLAN_LIMITS[plan].documents) {
      throw new PlanLimitException('documents', plan);
    }
  }
}
