import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PlanTier, PublicationStatus } from '@prisma/client';
import { randomBytes } from 'crypto';
import sanitizeHtml from 'sanitize-html';
import { AccessService, AccessContext, hashToken } from '../access/access.service';
import { canEdit, canManage } from '../access/access.policy';
import { COLLAB_CONTROL, CollabControl } from '../collab/collab-control';
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
		@Inject(COLLAB_CONTROL) private readonly rooms: CollabControl,
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

	async create(workspaceId: string, userId: string, dto: CreateDocumentDto) {
		await this.access.assertWorkspaceDocumentCreate(workspaceId, userId);
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
		await this.outbox.enqueue({
			type: 'page.revalidate',
			aggregateType: 'document',
			aggregateId: document.id,
			idempotencyKey: `revalidate:tree:create:${document.id}`,
			payload: {
				documentId: document.id,
				tag: `workspace-tree:${workspaceId}`,
				path: `/app/w/${workspaceId}`,
			},
		});
		return document;
	}

	async get(documentId: string, ctx: AccessContext) {
		const { document, level } = await this.access.assertDocumentView(documentId, ctx);
		const canManageDoc = canManage(level);
		const [projection, shares, shareInvitations, publicLinks] = await Promise.all([
			this.prisma.documentProjection.findUnique({
				where: { documentId },
			}),
			canManageDoc
				? this.prisma.documentShare.findMany({
						where: { documentId },
						include: {
							user: {
								select: { id: true, email: true, displayName: true },
							},
						},
						orderBy: { createdAt: 'asc' },
					})
				: Promise.resolve([]),
			canManageDoc
				? this.prisma.documentShareInvitation.findMany({
						where: {
							documentId,
							status: 'PENDING',
							expiresAt: { gt: new Date() },
						},
						orderBy: { createdAt: 'desc' },
						select: {
							id: true,
							email: true,
							access: true,
							expiresAt: true,
							createdAt: true,
						},
					})
				: Promise.resolve([]),
			canManageDoc
				? this.prisma.documentPublicLink.findMany({
						where: { documentId, revokedAt: null },
						select: {
							id: true,
							tokenPrefix: true,
							access: true,
							expiresAt: true,
							createdAt: true,
						},
						orderBy: { createdAt: 'desc' },
					})
				: Promise.resolve([]),
		]);
		return {
			...document,
			access: level,
			projection,
			shares,
			shareInvitations,
			publicLinks,
		};
	}

	async getShared(documentId: string, shareToken: string) {
		if (!shareToken.trim()) {
			throw new BadRequestException('Share token is required');
		}
		const { document, level } = await this.access.assertDocumentView(documentId, {
			shareToken,
		});
		return {
			id: document.id,
			workspaceId: document.workspaceId,
			title: document.title,
			publicationStatus: document.publicationStatus,
			publicSlug: document.publicSlug,
			publishedAt: document.publishedAt,
			access: level,
			shares: [],
			publicLinks: [],
		};
	}

	async listSharedWithMe(userId: string) {
		const shares = await this.prisma.documentShare.findMany({
			where: {
				userId,
				document: { deletedAt: null },
			},
			include: {
				document: {
					select: {
						id: true,
						title: true,
						workspaceId: true,
						publicationStatus: true,
						updatedAt: true,
						workspace: { select: { id: true, name: true, slug: true } },
					},
				},
			},
			orderBy: { updatedAt: 'desc' },
		});

		return shares.map((share) => ({
			shareId: share.id,
			access: share.access,
			documentId: share.document.id,
			title: share.document.title,
			workspaceId: share.document.workspaceId,
			workspaceName: share.document.workspace.name,
			workspaceSlug: share.document.workspace.slug,
			publicationStatus: share.document.publicationStatus,
			updatedAt: share.document.updatedAt,
		}));
	}

	async rename(documentId: string, ctx: AccessContext, title: string) {
		await this.access.assertDocumentEdit(documentId, ctx);
		const document = await this.prisma.document.update({
			where: { id: documentId },
			data: { title },
		});
		await this.enqueueIndex(document.workspaceId, document.id);
		await this.outbox.enqueue({
			type: 'page.revalidate',
			aggregateType: 'document',
			aggregateId: document.id,
			idempotencyKey: `revalidate:tree:rename:${document.id}:${document.updatedAt.toISOString()}`,
			payload: {
				documentId: document.id,
				tag: `workspace-tree:${document.workspaceId}`,
				path: `/app/w/${document.workspaceId}`,
			},
		});
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
		const moved = await this.prisma.document.update({
			where: { id: documentId },
			data: {
				parentId: dto.parentId === undefined ? document.parentId : dto.parentId,
				rank: dto.rank ?? nextRank(last?.rank),
			},
		});
		await this.outbox.enqueue({
			type: 'page.revalidate',
			aggregateType: 'document',
			aggregateId: documentId,
			idempotencyKey: `revalidate:tree:move:${documentId}:${moved.updatedAt.toISOString()}`,
			payload: {
				documentId,
				tag: `workspace-tree:${document.workspaceId}`,
				path: `/app/w/${document.workspaceId}`,
			},
		});
		return moved;
	}

	async remove(documentId: string, ctx: AccessContext) {
		await this.access.assertDocumentEdit(documentId, ctx);
		const document = await this.prisma.document.update({
			where: { id: documentId },
			data: { deletedAt: new Date() },
		});
		// Active editors must get document_deleted and have sockets closed.
		await this.rooms.closeDeleted(documentId);
		await this.outbox.enqueue({
			type: 'search.delete',
			aggregateType: 'document',
			aggregateId: document.id,
			idempotencyKey: `search:delete:${document.id}:${document.deletedAt?.toISOString()}`,
			payload: { documentId: document.id, workspaceId: document.workspaceId },
		});
		await this.outbox.enqueue({
			type: 'page.revalidate',
			aggregateType: 'document',
			aggregateId: document.id,
			idempotencyKey: `revalidate:tree:delete:${document.id}:${document.deletedAt?.toISOString()}`,
			payload: {
				documentId: document.id,
				tag: `workspace-tree:${document.workspaceId}`,
				path: `/app/w/${document.workspaceId}`,
			},
		});
		return document;
	}

	async publish(documentId: string, ctx: AccessContext, published: boolean) {
		const { document, level } = await this.access.assertDocumentEdit(documentId, ctx);
		if (!canEdit(level)) {
			throw new BadRequestException('Cannot publish this document');
		}
		// Edge case: publish must project live Y.Doc (incl. edits not yet flushed).
		await this.rooms.flushProjection(documentId);
		const fresh = await this.prisma.document.findUniqueOrThrow({
			where: { id: documentId },
		});
		const publicSlug =
			published && !fresh.publicSlug
				? slugify(fresh.title, randomBytes(4).toString('hex'))
				: fresh.publicSlug;
		const updated = await this.prisma.document.update({
			where: { id: documentId },
			data: {
				publicationStatus: published
					? PublicationStatus.PUBLISHED
					: PublicationStatus.UNPUBLISHED,
				publicSlug: published ? publicSlug : fresh.publicSlug,
				publishedAt: published ? new Date() : fresh.publishedAt,
			},
		});
		await this.outbox.enqueue({
			type: 'page.revalidate',
			aggregateType: 'document',
			aggregateId: document.id,
			idempotencyKey: `revalidate:${document.id}:${updated.updatedAt.toISOString()}`,
			payload: {
				slug: updated.publicSlug,
				documentId,
				tag: `workspace-tree:${document.workspaceId}`,
				path: `/app/w/${document.workspaceId}`,
			},
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
		const { document } = await this.access.assertDocumentManage(documentId, ctx);
		if (dto.access === 'MANAGE') {
			throw new BadRequestException('MANAGE is reserved for workspace admins');
		}
		const email = dto.email.toLowerCase().trim();
		const existingUser = await this.prisma.user.findUnique({
			where: { email },
			select: { id: true, email: true, displayName: true },
		});
		if (!existingUser) {
			throw new NotFoundException('User not found');
		}

		const member = await this.prisma.workspaceMember.findUnique({
			where: {
				workspaceId_userId: {
					workspaceId: document.workspaceId,
					userId: existingUser.id,
				},
			},
		});
		if (member?.role === 'OWNER' || member?.role === 'ADMIN') {
			throw new BadRequestException(
				'Owner/Admin already have full access; document permission cannot change it',
			);
		}

		const existingShare = await this.prisma.documentShare.findUnique({
			where: {
				documentId_userId: { documentId, userId: existingUser.id },
			},
		});
		if (existingShare && existingShare.access === dto.access) {
			throw new BadRequestException('User already has this document permission');
		}

		const pending = await this.prisma.documentShareInvitation.findFirst({
			where: { documentId, email, status: 'PENDING' },
			orderBy: { createdAt: 'desc' },
		});
		if (pending) {
			if (pending.expiresAt > new Date()) {
				throw new BadRequestException('Share invitation already pending for this email');
			}
			await this.prisma.documentShareInvitation.update({
				where: { id: pending.id },
				data: { status: 'REVOKED' },
			});
		}

		const inviter = ctx.userId
			? await this.prisma.user.findUnique({
					where: { id: ctx.userId },
					select: { displayName: true },
				})
			: null;
		const workspace = await this.prisma.workspace.findUniqueOrThrow({
			where: { id: document.workspaceId },
			select: { name: true },
		});

		const invitation = await this.prisma.documentShareInvitation.create({
			data: {
				documentId,
				email,
				access: dto.access,
				invitedById: ctx.userId!,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			},
		});

		await this.outbox.enqueue({
			type: 'notification.document_share',
			aggregateType: 'document',
			aggregateId: documentId,
			idempotencyKey: `doc-share:${invitation.id}`,
			payload: {
				invitationId: invitation.id,
				userId: existingUser.id,
				email,
				access: dto.access,
				documentId,
				documentTitle: document.title,
				workspaceId: document.workspaceId,
				workspaceName: workspace.name,
				invitedByName: inviter?.displayName ?? 'Someone',
			},
		});

		return {
			status: 'invited' as const,
			id: invitation.id,
			email,
			access: dto.access,
			displayName: existingUser.displayName,
			expiresAt: invitation.expiresAt,
		};
	}

	async respondShareInvite(
		userId: string,
		userEmail: string,
		invitationId: string,
		action: 'accept' | 'decline',
	) {
		const invitation = await this.prisma.documentShareInvitation.findUnique({
			where: { id: invitationId },
			include: {
				document: {
					select: {
						id: true,
						title: true,
						workspaceId: true,
						deletedAt: true,
					},
				},
			},
		});
		if (
			!invitation ||
			invitation.status !== 'PENDING' ||
			invitation.expiresAt < new Date() ||
			invitation.document.deletedAt
		) {
			throw new NotFoundException('Share invitation not found or expired');
		}
		if (invitation.email !== userEmail.toLowerCase().trim()) {
			throw new BadRequestException(
				'Sign in with the invited email to respond to this share',
			);
		}

		if (action === 'decline') {
			await this.prisma.documentShareInvitation.update({
				where: { id: invitation.id },
				data: { status: 'DECLINED' },
			});
			return {
				status: 'declined' as const,
				documentId: invitation.documentId,
				workspaceId: invitation.document.workspaceId,
			};
		}

		const share = await this.prisma.$transaction(async (tx) => {
			await tx.documentShareInvitation.update({
				where: { id: invitation.id },
				data: { status: 'ACCEPTED', acceptedAt: new Date() },
			});
			return tx.documentShare.upsert({
				where: {
					documentId_userId: {
						documentId: invitation.documentId,
						userId,
					},
				},
				update: { access: invitation.access },
				create: {
					documentId: invitation.documentId,
					userId,
					access: invitation.access,
				},
				include: {
					user: {
						select: { id: true, email: true, displayName: true },
					},
				},
			});
		});

		await this.rooms.revalidateUserOnDocument(invitation.documentId, userId);
		return {
			status: 'accepted' as const,
			documentId: invitation.documentId,
			workspaceId: invitation.document.workspaceId,
			documentTitle: invitation.document.title,
			access: share.access,
		};
	}

	async unshare(documentId: string, ctx: AccessContext, shareUserId: string) {
		await this.access.assertDocumentManage(documentId, ctx);
		await this.prisma.documentShare.deleteMany({
			where: { documentId, userId: shareUserId },
		});
		await this.rooms.revalidateUserOnDocument(documentId, shareUserId);
		return { removed: true };
	}

	async updateShareAccess(
		documentId: string,
		ctx: AccessContext,
		shareUserId: string,
		access: 'VIEW' | 'EDIT' | 'MANAGE',
	) {
		await this.access.assertDocumentManage(documentId, ctx);
		if (access === 'MANAGE') {
			throw new BadRequestException('MANAGE is reserved for workspace admins');
		}
		const existing = await this.prisma.documentShare.findUnique({
			where: {
				documentId_userId: { documentId, userId: shareUserId },
			},
		});
		if (!existing) {
			throw new NotFoundException('Share not found');
		}
		const share = await this.prisma.documentShare.update({
			where: { id: existing.id },
			data: { access },
			include: {
				user: {
					select: { id: true, email: true, displayName: true },
				},
			},
		});
		await this.rooms.revalidateUserOnDocument(documentId, shareUserId);
		return share;
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

	async updatePublicLink(
		documentId: string,
		linkId: string,
		ctx: AccessContext,
		access: 'VIEW' | 'EDIT' | 'MANAGE',
	) {
		await this.access.assertDocumentManage(documentId, ctx);
		if (access === 'MANAGE') {
			throw new BadRequestException('Public links cannot grant MANAGE');
		}
		const existing = await this.prisma.documentPublicLink.findFirst({
			where: { id: linkId, documentId, revokedAt: null },
		});
		if (!existing) {
			throw new NotFoundException('Public link not found');
		}
		const link = await this.prisma.documentPublicLink.update({
			where: { id: linkId },
			data: { access },
			select: {
				id: true,
				tokenPrefix: true,
				access: true,
				expiresAt: true,
				createdAt: true,
			},
		});
		await this.rooms.revalidateAllClientsOnDocument(documentId);
		return link;
	}

	async revokePublicLink(documentId: string, linkId: string, ctx: AccessContext) {
		await this.access.assertDocumentManage(documentId, ctx);
		const existing = await this.prisma.documentPublicLink.findFirst({
			where: { id: linkId, documentId, revokedAt: null },
		});
		if (!existing) {
			throw new NotFoundException('Public link not found');
		}
		await this.prisma.documentPublicLink.update({
			where: { id: linkId },
			data: { revokedAt: new Date() },
		});
		await this.rooms.revalidateAllClientsOnDocument(documentId);
		return { revoked: true, id: linkId };
	}

	async listVersions(documentId: string, ctx: AccessContext) {
		await this.access.assertDocumentView(documentId, ctx);
		return this.prisma.documentVersion.findMany({
			where: { documentId },
			orderBy: { createdAt: 'desc' },
			select: {
				id: true,
				title: true,
				trigger: true,
				createdAt: true,
				createdById: true,
			},
		});
	}

	async createSnapshot(documentId: string, ctx: AccessContext, userId: string) {
		const { document } = await this.access.assertDocumentEdit(documentId, ctx);
		const version = await this.collab.snapshot(documentId, document.title, 'MANUAL', userId);
		return {
			id: version.id,
			title: version.title,
			trigger: version.trigger,
			createdAt: version.createdAt,
		};
	}

	async restoreVersion(
		documentId: string,
		versionId: string,
		ctx: AccessContext,
		userId: string,
	) {
		await this.access.assertDocumentEdit(documentId, ctx);
		const version = await this.prisma.documentVersion.findFirst({
			where: { id: versionId, documentId },
		});
		if (!version) {
			throw new NotFoundException('Version not found');
		}
		await this.collab.snapshot(documentId, version.title, 'RESTORE', userId);
		await this.collab.replaceState(documentId, new Uint8Array(version.state));
		await this.rooms.reload(documentId);
		return { restored: versionId };
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
