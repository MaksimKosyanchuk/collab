import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { WorkspacesService } from './workspaces.service';
import {
  AcceptInviteDto,
  CreateWorkspaceDto,
  InviteMemberDto,
  UpdateMemberRoleDto,
} from './dto/workspace.dto';

@ApiTags('workspaces')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}

  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateWorkspaceDto) {
    return this.workspaces.create(user.id, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.workspaces.listForUser(user.id);
  }

  @Post('invitations/accept')
  accept(@CurrentUser() user: AuthUser, @Body() dto: AcceptInviteDto) {
    return this.workspaces.acceptInvite(user.id, user.email, dto.token);
  }

  @Get(':workspaceId')
  get(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.workspaces.get(workspaceId, user.id);
  }

  @Post(':workspaceId/invitations')
  invite(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: InviteMemberDto,
  ) {
    return this.workspaces.invite(workspaceId, user.id, dto);
  }

  @Patch(':workspaceId/members/:memberUserId')
  updateRole(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Param('memberUserId') memberUserId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.workspaces.updateMemberRole(
      workspaceId,
      user.id,
      memberUserId,
      dto.role,
    );
  }

  @Delete(':workspaceId/members/:memberUserId')
  removeMember(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Param('memberUserId') memberUserId: string,
  ) {
    return this.workspaces.removeMember(workspaceId, user.id, memberUserId);
  }
}
