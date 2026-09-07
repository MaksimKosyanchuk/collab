import { createHash } from 'crypto';
import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Document } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  AccessLevelValue,
  canEdit,
  canManage,
  canView,
  resolveDocumentAccess,
} from './access.policy';

export type AccessContext = {
  userId?: string | null;
  shareToken?: string | null;
};

@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspaceRole(workspaceId: string, userId?: string | null) {
    if (!userId) {
      return null;
    }
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    return member?.role ?? null;
  }

  async assertWorkspaceMember(workspaceId: string, userId: string) {
    const role = await this.getWorkspaceRole(workspaceId, userId);
    if (!role) {
      throw new ForbiddenException('No access to this workspace');
    }
    return role;
  }

  async assertWorkspaceManage(workspaceId: string, userId: string) {
    const role = await this.assertWorkspaceMember(workspaceId, userId);
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new ForbiddenException('Workspace admin role required');
    }
    return role;
  }

  async resolveDocument(
    documentId: string,
    ctx: AccessContext,
  ): Promise<{ document: Document; level: AccessLevelValue }> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document || document.deletedAt) {
      throw new NotFoundException('Document not found');
    }

    const workspaceRole = await this.getWorkspaceRole(
      document.workspaceId,
      ctx.userId,
    );

    let shareAccess: 'VIEW' | 'EDIT' | 'MANAGE' | null = null;
    if (ctx.userId) {
      const share = await this.prisma.documentShare.findUnique({
        where: {
          documentId_userId: { documentId, userId: ctx.userId },
        },
      });
      shareAccess = share?.access ?? null;
    }

    let publicLinkAccess: 'VIEW' | 'EDIT' | 'MANAGE' | null = null;
    if (ctx.shareToken) {
      const tokenHash = hashToken(ctx.shareToken);
      const link = await this.prisma.documentPublicLink.findUnique({
        where: { tokenHash },
      });
      const valid =
        !!link &&
        link.documentId === documentId &&
        !link.revokedAt &&
        (!link.expiresAt || link.expiresAt > new Date());
      publicLinkAccess = valid && link ? link.access : null;
    }

    const level = resolveDocumentAccess({
      workspaceRole,
      shareAccess,
      publicLinkAccess,
    });

    if (!canView(level)) {
      throw new ForbiddenException('No access to this document');
    }

    return { document, level };
  }

  async assertDocumentView(documentId: string, ctx: AccessContext) {
    return this.resolveDocument(documentId, ctx);
  }

  async assertDocumentEdit(documentId: string, ctx: AccessContext) {
    const resolved = await this.resolveDocument(documentId, ctx);
    if (!canEdit(resolved.level)) {
      throw new ForbiddenException('Edit access required');
    }
    return resolved;
  }

  async assertDocumentManage(documentId: string, ctx: AccessContext) {
    const resolved = await this.resolveDocument(documentId, ctx);
    if (!canManage(resolved.level)) {
      throw new ForbiddenException('Manage access required');
    }
    return resolved;
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
