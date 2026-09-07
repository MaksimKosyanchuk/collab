import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { WorkspacesService } from './workspaces.service';
import {
	AcceptInviteDto,
	CreateWorkspaceDto,
	InviteMemberDto,
	RenameWorkspaceDto,
	RespondInviteDto,
	UpdateMemberRoleDto,
} from './dto/workspace.dto';

@ApiTags('workspaces')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
	constructor(private readonly workspaces: WorkspacesService) {}

	@Post()
	@ApiOperation({ summary: 'Create a workspace' })
	create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
		return this.workspaces.create(user.id, dto);
	}

	@Get()
	@ApiOperation({ summary: 'List workspaces for current user' })
	list(@CurrentUser() user: AuthUser) {
		return this.workspaces.listForUser(user.id);
	}

	@Post('invitations/accept')
	@ApiOperation({ summary: 'Accept a workspace invitation by token' })
	accept(@CurrentUser() user: AuthUser, @Body() dto: AcceptInviteDto) {
		return this.workspaces.acceptInvite(user.id, user.email, dto.token);
	}

	@Post('invitations/respond')
	@ApiOperation({ summary: 'Accept or decline a workspace invitation' })
	respond(@CurrentUser() user: AuthUser, @Body() dto: RespondInviteDto) {
		return this.workspaces.respondInvite(user.id, user.email, dto.invitationId, dto.action);
	}

	@Get(':workspaceId')
	@ApiOperation({ summary: 'Get workspace details' })
	@ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
	get(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) {
		return this.workspaces.get(workspaceId, user.id);
	}

	@Patch(':workspaceId')
	@ApiOperation({ summary: 'Rename a workspace' })
	@ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
	rename(
		@CurrentUser() user: AuthUser,
		@Param('workspaceId') workspaceId: string,
		@Body() dto: RenameWorkspaceDto,
	) {
		return this.workspaces.rename(workspaceId, user.id, dto.name);
	}

	@Post(':workspaceId/invitations')
	@ApiOperation({ summary: 'Invite a member to the workspace' })
	@ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
	invite(
		@CurrentUser() user: AuthUser,
		@Param('workspaceId') workspaceId: string,
		@Body() dto: InviteMemberDto,
	) {
		return this.workspaces.invite(workspaceId, user.id, dto);
	}

	@Patch(':workspaceId/members/:memberUserId')
	@ApiOperation({ summary: 'Update a workspace member role' })
	@ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
	@ApiParam({ name: 'memberUserId', description: 'Member user ID' })
	updateRole(
		@CurrentUser() user: AuthUser,
		@Param('workspaceId') workspaceId: string,
		@Param('memberUserId') memberUserId: string,
		@Body() dto: UpdateMemberRoleDto,
	) {
		return this.workspaces.updateMemberRole(workspaceId, user.id, memberUserId, dto.role);
	}

	@Delete(':workspaceId/members/:memberUserId')
	@ApiOperation({ summary: 'Remove a member from the workspace' })
	@ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
	@ApiParam({ name: 'memberUserId', description: 'Member user ID' })
	removeMember(
		@CurrentUser() user: AuthUser,
		@Param('workspaceId') workspaceId: string,
		@Param('memberUserId') memberUserId: string,
	) {
		return this.workspaces.removeMember(workspaceId, user.id, memberUserId);
	}

	@Post(':workspaceId/leave')
	@ApiOperation({ summary: 'Leave a workspace' })
	@ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
	leave(@CurrentUser() user: AuthUser, @Param('workspaceId') workspaceId: string) {
		return this.workspaces.leave(workspaceId, user.id);
	}
}
