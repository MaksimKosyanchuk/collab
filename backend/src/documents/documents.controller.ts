import {
	Body,
	Controller,
	Delete,
	Get,
	Headers,
	Param,
	Patch,
	Post,
	Query,
	UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { DocumentsService } from './documents.service';
import {
	CreateDocumentDto,
	CreatePublicLinkDto,
	MoveDocumentDto,
	PublishDocumentDto,
	RenameDocumentDto,
	RespondDocumentShareDto,
	ShareDocumentDto,
} from './dto/document.dto';
@ApiTags('documents')
@Controller()
export class DocumentsController {
	constructor(private readonly documents: DocumentsService) {}
	@Get('public/documents/:slug')
	@ApiOperation({ summary: 'Get a published public document by slug' })
	@ApiParam({ name: 'slug', description: 'Public document slug' })
	getPublished(
		@Param('slug')
		slug: string,
	) {
		return this.documents.getPublished(slug);
	}
	@Throttle({ default: { limit: 60, ttl: 60000 } })
	@Get('public/documents/:documentId/shared')
	@ApiOperation({ summary: 'Get a document via public share token' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	@ApiQuery({
		name: 'token',
		required: false,
		description: 'Public share token (also accepted via X-Share-Token header)',
	})
	getShared(
		@Param('documentId')
		documentId: string,
		@Query('token')
		token?: string,
		@Headers('x-share-token')
		shareToken?: string,
	) {
		return this.documents.getShared(documentId, token ?? shareToken ?? '');
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Get('documents/shared')
	@ApiOperation({ summary: 'List documents shared with the current user' })
	listSharedWithMe(
		@CurrentUser()
		user: AuthUser,
	) {
		return this.documents.listSharedWithMe(user.id);
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Post('documents/share-invitations/respond')
	@ApiOperation({ summary: 'Accept or decline a document share invitation' })
	respondShareInvite(
		@CurrentUser()
		user: AuthUser,
		@Body()
		dto: RespondDocumentShareDto,
	) {
		return this.documents.respondShareInvite(user.id, user.email, dto.invitationId, dto.action);
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Get('workspaces/:workspaceId/documents')
	@ApiOperation({ summary: 'Get document tree for a workspace' })
	@ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
	tree(
		@CurrentUser()
		user: AuthUser,
		@Param('workspaceId')
		workspaceId: string,
	) {
		return this.documents.tree(workspaceId, user.id);
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Post('workspaces/:workspaceId/documents')
	@ApiOperation({ summary: 'Create a document in a workspace' })
	@ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
	create(
		@CurrentUser()
		user: AuthUser,
		@Param('workspaceId')
		workspaceId: string,
		@Body()
		dto: CreateDocumentDto,
	) {
		return this.documents.create(workspaceId, user.id, dto);
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Get('documents/:documentId')
	@ApiOperation({ summary: 'Get a document by ID' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	get(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
		@Headers('x-share-token')
		shareToken?: string,
	) {
		return this.documents.get(documentId, { userId: user.id, shareToken });
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Patch('documents/:documentId')
	@ApiOperation({ summary: 'Rename a document' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	rename(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
		@Body()
		dto: RenameDocumentDto,
	) {
		return this.documents.rename(documentId, { userId: user.id }, dto.title);
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Post('documents/:documentId/move')
	@ApiOperation({ summary: 'Move a document in the tree' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	move(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
		@Body()
		dto: MoveDocumentDto,
	) {
		return this.documents.move(documentId, { userId: user.id }, dto);
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Delete('documents/:documentId')
	@ApiOperation({ summary: 'Delete a document' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	remove(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
	) {
		return this.documents.remove(documentId, { userId: user.id });
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Post('documents/:documentId/publish')
	@ApiOperation({ summary: 'Publish or unpublish a document' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	publish(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
		@Body()
		dto: PublishDocumentDto,
	) {
		return this.documents.publish(documentId, { userId: user.id }, dto.published);
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Post('documents/:documentId/shares')
	@ApiOperation({ summary: 'Share a document with a user' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	share(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
		@Body()
		dto: ShareDocumentDto,
	) {
		return this.documents.share(documentId, { userId: user.id }, dto);
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Patch('documents/:documentId/shares/:shareUserId')
	@ApiOperation({ summary: 'Update share access for a user' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	@ApiParam({ name: 'shareUserId', description: 'Shared user ID' })
	updateShare(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
		@Param('shareUserId')
		shareUserId: string,
		@Body()
		dto: CreatePublicLinkDto,
	) {
		return this.documents.updateShareAccess(
			documentId,
			{ userId: user.id },
			shareUserId,
			dto.access,
		);
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Delete('documents/:documentId/shares/:shareUserId')
	@ApiOperation({ summary: 'Remove a user share from a document' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	@ApiParam({ name: 'shareUserId', description: 'Shared user ID' })
	unshare(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
		@Param('shareUserId')
		shareUserId: string,
	) {
		return this.documents.unshare(documentId, { userId: user.id }, shareUserId);
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Throttle({ default: { limit: 10, ttl: 60000 } })
	@Post('documents/:documentId/public-links')
	@ApiOperation({ summary: 'Create a public share link' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	createPublicLink(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
		@Body()
		dto: CreatePublicLinkDto,
	) {
		return this.documents.createPublicLink(documentId, { userId: user.id }, user.id, dto);
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Patch('documents/:documentId/public-links/:linkId')
	@ApiOperation({ summary: 'Update a public share link' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	@ApiParam({ name: 'linkId', description: 'Public link ID' })
	updatePublicLink(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
		@Param('linkId')
		linkId: string,
		@Body()
		dto: CreatePublicLinkDto,
	) {
		return this.documents.updatePublicLink(documentId, linkId, { userId: user.id }, dto.access);
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Delete('documents/:documentId/public-links/:linkId')
	@ApiOperation({ summary: 'Revoke a public share link' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	@ApiParam({ name: 'linkId', description: 'Public link ID' })
	revokePublicLink(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
		@Param('linkId')
		linkId: string,
	) {
		return this.documents.revokePublicLink(documentId, linkId, {
			userId: user.id,
		});
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Get('documents/:documentId/versions')
	@ApiOperation({ summary: 'List document versions' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	listVersions(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
	) {
		return this.documents.listVersions(documentId, { userId: user.id });
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Post('documents/:documentId/versions')
	@ApiOperation({ summary: 'Create a document version snapshot' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	snapshot(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
	) {
		return this.documents.createSnapshot(documentId, { userId: user.id }, user.id);
	}
	@ApiBearerAuth('JWT-auth')
	@UseGuards(JwtAuthGuard)
	@Post('documents/:documentId/versions/:versionId/restore')
	@ApiOperation({ summary: 'Restore a document version' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	@ApiParam({ name: 'versionId', description: 'Version ID' })
	restore(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
		@Param('versionId')
		versionId: string,
	) {
		return this.documents.restoreVersion(documentId, versionId, { userId: user.id }, user.id);
	}
}
