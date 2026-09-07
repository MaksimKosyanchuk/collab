import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { CommentsService } from './comments.service';
import { CreateCommentDto, CreateThreadDto } from './dto/comment.dto';
@ApiTags('comments')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller()
export class CommentsController {
	constructor(private readonly comments: CommentsService) {}
	@Get('documents/:documentId/comments')
	@ApiOperation({ summary: 'List comment threads for a document' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	list(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
	) {
		return this.comments.list(documentId, { userId: user.id });
	}
	@Post('documents/:documentId/comments')
	@ApiOperation({ summary: 'Create a comment thread on a document' })
	@ApiParam({ name: 'documentId', description: 'Document ID' })
	createThread(
		@CurrentUser()
		user: AuthUser,
		@Param('documentId')
		documentId: string,
		@Body()
		dto: CreateThreadDto,
	) {
		return this.comments.createThread(documentId, user.id, dto.blockId, dto.body);
	}
	@Post('comment-threads/:threadId/comments')
	@ApiOperation({ summary: 'Add a comment to a thread' })
	@ApiParam({ name: 'threadId', description: 'Comment thread ID' })
	addComment(
		@CurrentUser()
		user: AuthUser,
		@Param('threadId')
		threadId: string,
		@Body()
		dto: CreateCommentDto,
	) {
		return this.comments.addComment(threadId, user.id, dto.body);
	}
	@Post('comment-threads/:threadId/resolve')
	@ApiOperation({ summary: 'Resolve a comment thread' })
	@ApiParam({ name: 'threadId', description: 'Comment thread ID' })
	resolve(
		@CurrentUser()
		user: AuthUser,
		@Param('threadId')
		threadId: string,
	) {
		return this.comments.resolve(threadId, user.id, true);
	}
}
