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

type InvitePayload = {
	invitationId: string;
	userId: string;
	email: string;
	role: string;
	workspaceId: string;
	workspaceName: string;
	invitedByName: string;
};

type DocumentSharePayload = {
	invitationId: string;
	userId: string;
	email: string;
	access: string;
	documentId: string;
	documentTitle: string;
	workspaceId: string;
	workspaceName: string;
	invitedByName: string;
};

@Processor('notifications')
export class NotificationsProcessor extends WorkerHost {
	private readonly logger = new Logger(NotificationsProcessor.name);

	constructor(private readonly prisma: PrismaService) {
		super();
	}

	async process(job: Job): Promise<void> {
		if (job.name === 'notification.mention') {
			await this.handleMention(job as Job<MentionPayload>);
			return;
		}
		if (job.name === 'notification.invite') {
			await this.handleInvite(job as Job<InvitePayload>);
			return;
		}
		if (job.name === 'notification.document_share') {
			await this.handleDocumentShare(job as Job<DocumentSharePayload>);
			return;
		}
		this.logger.debug(`Skip notification job ${job.name}`);
	}

	private async handleDocumentShare(job: Job<DocumentSharePayload>): Promise<void> {
		const data = job.data ?? ({} as DocumentSharePayload);
		let userId = data.userId;
		const invitationId = data.invitationId;
		const email = data.email?.toLowerCase().trim();

		if (!invitationId) {
			this.logger.warn(`Doc share job ${job.id} missing invitationId`);
			return;
		}
		if (!userId && email) {
			const user = await this.prisma.user.findUnique({
				where: { email },
				select: { id: true },
			});
			userId = user?.id ?? '';
		}
		if (!userId) {
			this.logger.warn(`Doc share job ${job.id} has no target user (${invitationId})`);
			return;
		}

		const invitation = await this.prisma.documentShareInvitation.findUnique({
			where: { id: invitationId },
			include: {
				document: {
					select: {
						id: true,
						title: true,
						workspaceId: true,
						workspace: { select: { name: true } },
					},
				},
				invitedBy: { select: { displayName: true } },
			},
		});
		if (!invitation || invitation.status !== 'PENDING') {
			return;
		}

		const eventId = `doc-share:${invitationId}`;
		try {
			await this.prisma.notification.create({
				data: {
					userId,
					eventId,
					type: NotificationType.DOCUMENT_SHARED,
					payload: {
						invitationId,
						email: invitation.email,
						access: invitation.access,
						documentId: invitation.documentId,
						documentTitle: data.documentTitle ?? invitation.document.title,
						workspaceId: invitation.document.workspaceId,
						workspaceName: data.workspaceName ?? invitation.document.workspace.name,
						invitedByName: data.invitedByName ?? invitation.invitedBy.displayName,
					} as Prisma.InputJsonValue,
				},
			});
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				return;
			}
			throw error;
		}
	}

	private async handleInvite(job: Job<InvitePayload>): Promise<void> {
		const data = job.data ?? ({} as InvitePayload);
		let userId = data.userId;
		const invitationId = data.invitationId;
		const email = data.email?.toLowerCase().trim();

		if (!invitationId) {
			this.logger.warn(`Invite job ${job.id} missing invitationId`);
			return;
		}

		if (!userId && email) {
			const user = await this.prisma.user.findUnique({
				where: { email },
				select: { id: true },
			});
			userId = user?.id ?? '';
		}
		if (!userId) {
			this.logger.warn(
				`Invite job ${job.id} has no target user (invitation ${invitationId})`,
			);
			return;
		}

		const invitation = await this.prisma.workspaceInvitation.findUnique({
			where: { id: invitationId },
			include: {
				workspace: { select: { name: true } },
				invitedBy: { select: { displayName: true } },
			},
		});
		if (!invitation || invitation.status !== 'PENDING') {
			return;
		}

		const eventId = `invite:${invitationId}`;
		try {
			await this.prisma.notification.create({
				data: {
					userId,
					eventId,
					type: NotificationType.INVITE,
					payload: {
						invitationId,
						email: invitation.email,
						role: invitation.role,
						workspaceId: invitation.workspaceId,
						workspaceName: data.workspaceName ?? invitation.workspace.name,
						invitedByName: data.invitedByName ?? invitation.invitedBy.displayName,
					} as Prisma.InputJsonValue,
				},
			});
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				return;
			}
			throw error;
		}
	}

	private async handleMention(job: Job<MentionPayload>): Promise<void> {
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
