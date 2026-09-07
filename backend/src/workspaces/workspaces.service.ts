import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { PlanTier, Workspace, WorkspaceRole } from '@prisma/client';
import { randomBytes } from 'crypto';
import { AccessService, hashToken } from '../access/access.service';
import { COLLAB_CONTROL, CollabControl } from '../collab/collab-control';
import { PlanLimitException } from '../common/exceptions/plan-limit.exception';
import { slugify } from '../common/ids';
import { PLAN_LIMITS } from '../common/plan-limits';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../queue/outbox.service';
import { CreateWorkspaceDto, InviteMemberDto } from './dto/workspace.dto';
function toWorkspaceDto(workspace: Workspace) {
	return {
		...workspace,
		storageUsedBytes: workspace.storageUsedBytes.toString(),
	};
}
@Injectable()
export class WorkspacesService {
	constructor(
		private readonly prisma: PrismaService,
		private readonly access: AccessService,
		private readonly outbox: OutboxService,
		@Inject(COLLAB_CONTROL)
		private readonly rooms: CollabControl,
	) {}
	async create(userId: string, dto: CreateWorkspaceDto) {
		const slug = slugify(dto.name, randomBytes(3).toString('hex'));
		return this.prisma.$transaction(async (tx) => {
			const workspace = await tx.workspace.create({
				data: {
					name: dto.name,
					slug,
					ownerId: userId,
					plan: PlanTier.FREE,
					members: {
						create: { userId, role: WorkspaceRole.OWNER },
					},
					subscription: {
						create: { plan: PlanTier.FREE, status: 'ACTIVE' },
					},
				},
			});
			return toWorkspaceDto(workspace);
		});
	}
	async listForUser(userId: string) {
		const rows = await this.prisma.workspace.findMany({
			where: { members: { some: { userId } } },
			orderBy: { createdAt: 'desc' },
		});
		return rows.map(toWorkspaceDto);
	}
	async get(workspaceId: string, userId: string) {
		await this.access.assertWorkspaceMember(workspaceId, userId);
		const workspace = await this.prisma.workspace.findUnique({
			where: { id: workspaceId },
			include: {
				members: {
					include: {
						user: {
							select: { id: true, email: true, displayName: true },
						},
					},
					orderBy: { createdAt: 'asc' },
				},
				invitations: {
					where: { status: 'PENDING' },
					orderBy: { createdAt: 'desc' },
					select: {
						id: true,
						email: true,
						role: true,
						expiresAt: true,
						createdAt: true,
					},
				},
				subscription: true,
			},
		});
		if (!workspace) {
			throw new NotFoundException('Workspace not found');
		}
		const role = await this.access.getWorkspaceRole(workspaceId, userId);
		const canManage = role === 'OWNER' || role === 'ADMIN';
		return {
			...toWorkspaceDto(workspace),
			members: workspace.members,
			invitations: canManage ? workspace.invitations : [],
			myRole: role,
			subscription: workspace.subscription,
		};
	}
	async rename(workspaceId: string, userId: string, name: string) {
		await this.access.assertWorkspaceManage(workspaceId, userId);
		const trimmed = name.trim();
		if (trimmed.length < 2) {
			throw new BadRequestException('Name must be at least 2 characters');
		}
		const workspace = await this.prisma.workspace.update({
			where: { id: workspaceId },
			data: { name: trimmed },
		});
		return toWorkspaceDto(workspace);
	}
	async invite(workspaceId: string, userId: string, dto: InviteMemberDto) {
		await this.access.assertWorkspaceManage(workspaceId, userId);
		if (dto.role === WorkspaceRole.OWNER) {
			throw new BadRequestException('Cannot invite another owner');
		}
		const email = dto.email.toLowerCase().trim();
		const workspace = await this.prisma.workspace.findUniqueOrThrow({
			where: { id: workspaceId },
			include: {
				members: {
					where: { userId },
					include: {
						user: { select: { displayName: true } },
					},
					take: 1,
				},
			},
		});
		await this.assertMemberLimit(workspace.id, workspace.plan);
		const existingUser = await this.prisma.user.findUnique({
			where: { email },
			select: { id: true, email: true, displayName: true },
		});
		if (!existingUser) {
			throw new NotFoundException('User not found');
		}
		const member = await this.prisma.workspaceMember.findUnique({
			where: {
				workspaceId_userId: { workspaceId, userId: existingUser.id },
			},
		});
		if (member) {
			throw new BadRequestException('User is already a member');
		}
		const pending = await this.prisma.workspaceInvitation.findFirst({
			where: { workspaceId, email, status: 'PENDING' },
			orderBy: { createdAt: 'desc' },
		});
		if (pending) {
			if (pending.expiresAt > new Date()) {
				throw new BadRequestException('Invitation already pending for this email');
			}
			await this.prisma.workspaceInvitation.update({
				where: { id: pending.id },
				data: { status: 'REVOKED' },
			});
		}
		const inviterName = workspace.members[0]?.user.displayName ?? 'A workspace admin';
		const token = randomBytes(24).toString('base64url');
		const invitation = await this.prisma.workspaceInvitation.create({
			data: {
				workspaceId,
				email,
				role: dto.role,
				tokenHash: hashToken(token),
				invitedById: userId,
				expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
			},
		});
		await this.outbox.enqueue({
			type: 'notification.invite',
			aggregateType: 'workspace',
			aggregateId: workspaceId,
			idempotencyKey: `invite:${invitation.id}`,
			payload: {
				invitationId: invitation.id,
				userId: existingUser.id,
				email,
				role: dto.role,
				workspaceId,
				workspaceName: workspace.name,
				invitedByName: inviterName,
			},
		});
		return {
			status: 'invited' as const,
			id: invitation.id,
			email,
			role: dto.role,
			displayName: existingUser.displayName,
		};
	}
	async acceptInvite(userId: string, userEmail: string, token: string) {
		const invitation = await this.prisma.workspaceInvitation.findUnique({
			where: { tokenHash: hashToken(token) },
			include: { workspace: true },
		});
		return this.acceptInvitationRecord(userId, userEmail, invitation);
	}
	async respondInvite(
		userId: string,
		userEmail: string,
		invitationId: string,
		action: 'accept' | 'decline',
	) {
		const invitation = await this.prisma.workspaceInvitation.findUnique({
			where: { id: invitationId },
			include: { workspace: true },
		});
		if (action === 'decline') {
			return this.declineInvitationRecord(userId, userEmail, invitation);
		}
		return this.acceptInvitationRecord(userId, userEmail, invitation);
	}
	private async acceptInvitationRecord(
		userId: string,
		userEmail: string,
		invitation: {
			id: string;
			email: string;
			role: WorkspaceRole;
			status: string;
			expiresAt: Date;
			workspaceId: string;
			workspace: {
				name: string;
				plan: PlanTier;
			};
		} | null,
	) {
		if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
			throw new NotFoundException('Invitation not found or expired');
		}
		if (invitation.email !== userEmail.toLowerCase().trim()) {
			throw new BadRequestException('Sign in with the invited email to accept this invite');
		}
		await this.assertMemberLimit(invitation.workspaceId, invitation.workspace.plan);
		const member = await this.prisma.$transaction(async (tx) => {
			await tx.workspaceInvitation.update({
				where: { id: invitation.id },
				data: { status: 'ACCEPTED', acceptedAt: new Date() },
			});
			return tx.workspaceMember.upsert({
				where: {
					workspaceId_userId: {
						workspaceId: invitation.workspaceId,
						userId,
					},
				},
				update: { role: invitation.role },
				create: {
					workspaceId: invitation.workspaceId,
					userId,
					role: invitation.role,
				},
			});
		});
		return {
			status: 'accepted' as const,
			workspaceId: invitation.workspaceId,
			workspaceName: invitation.workspace.name,
			role: member.role,
		};
	}
	private async declineInvitationRecord(
		_userId: string,
		userEmail: string,
		invitation: {
			id: string;
			email: string;
			status: string;
			expiresAt: Date;
			workspaceId: string;
			workspace: {
				name: string;
			};
		} | null,
	) {
		if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt < new Date()) {
			throw new NotFoundException('Invitation not found or expired');
		}
		if (invitation.email !== userEmail.toLowerCase().trim()) {
			throw new BadRequestException('Sign in with the invited email to decline this invite');
		}
		await this.prisma.workspaceInvitation.update({
			where: { id: invitation.id },
			data: { status: 'DECLINED' },
		});
		return {
			status: 'declined' as const,
			workspaceId: invitation.workspaceId,
			workspaceName: invitation.workspace.name,
		};
	}
	async updateMemberRole(
		workspaceId: string,
		actorId: string,
		memberUserId: string,
		role: WorkspaceRole,
	) {
		await this.access.assertWorkspaceManage(workspaceId, actorId);
		if (role === WorkspaceRole.OWNER) {
			throw new BadRequestException('Use ownership transfer, not role update');
		}
		const member = await this.prisma.workspaceMember.findUnique({
			where: { workspaceId_userId: { workspaceId, userId: memberUserId } },
		});
		if (!member) {
			throw new NotFoundException('Member not found');
		}
		if (member.role === WorkspaceRole.OWNER) {
			throw new BadRequestException('Cannot change the owner role');
		}
		await this.assertNotLastManager(workspaceId, memberUserId, role);
		const updated = await this.prisma.workspaceMember.update({
			where: { id: member.id },
			data: { role },
		});
		await this.rooms.revalidateUserInWorkspace(workspaceId, memberUserId);
		return updated;
	}
	async removeMember(workspaceId: string, actorId: string, memberUserId: string) {
		await this.access.assertWorkspaceManage(workspaceId, actorId);
		const member = await this.prisma.workspaceMember.findUnique({
			where: { workspaceId_userId: { workspaceId, userId: memberUserId } },
		});
		if (!member) {
			throw new NotFoundException('Member not found');
		}
		if (member.role === WorkspaceRole.OWNER) {
			throw new BadRequestException('Cannot remove the owner');
		}
		await this.assertNotLastManager(workspaceId, memberUserId, null);
		await this.prisma.workspaceMember.delete({ where: { id: member.id } });
		await this.rooms.revalidateUserInWorkspace(workspaceId, memberUserId);
	}
	async leave(workspaceId: string, userId: string) {
		const member = await this.prisma.workspaceMember.findUnique({
			where: { workspaceId_userId: { workspaceId, userId } },
		});
		if (!member) {
			throw new NotFoundException('You are not a member of this workspace');
		}
		if (member.role === WorkspaceRole.OWNER) {
			throw new BadRequestException(
				'Owner cannot leave; transfer ownership or delete the workspace',
			);
		}
		await this.assertNotLastManager(workspaceId, userId, null);
		await this.prisma.workspaceMember.delete({ where: { id: member.id } });
		await this.rooms.revalidateUserInWorkspace(workspaceId, userId);
		return { left: true, workspaceId };
	}
	private async assertNotLastManager(
		workspaceId: string,
		memberUserId: string,
		nextRole: WorkspaceRole | null,
	) {
		if (nextRole === WorkspaceRole.OWNER || nextRole === WorkspaceRole.ADMIN) {
			return;
		}
		const managers = await this.prisma.workspaceMember.findMany({
			where: {
				workspaceId,
				role: { in: [WorkspaceRole.OWNER, WorkspaceRole.ADMIN] },
			},
			select: { userId: true, role: true },
		});
		const isManager = managers.some((row) => row.userId === memberUserId);
		if (!isManager) {
			return;
		}
		const remaining = managers.filter((row) => row.userId !== memberUserId);
		if (remaining.length === 0) {
			throw new BadRequestException('Cannot remove or demote the last workspace admin');
		}
	}
	private async assertMemberLimit(workspaceId: string, plan: PlanTier) {
		const count = await this.prisma.workspaceMember.count({
			where: { workspaceId },
		});
		if (count >= PLAN_LIMITS[plan].members) {
			throw new PlanLimitException('members', plan);
		}
	}
}
