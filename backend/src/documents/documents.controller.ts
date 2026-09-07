import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  ShareDocumentDto,
} from './dto/document.dto';

@ApiTags('documents')
@Controller()
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  @Get('public/documents/:slug')
  getPublished(@Param('slug') slug: string) {
    return this.documents.getPublished(slug);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get('workspaces/:workspaceId/documents')
  tree(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.documents.tree(workspaceId, user.id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('workspaces/:workspaceId/documents')
  create(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateDocumentDto,
  ) {
    return this.documents.create(workspaceId, user.id, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get('documents/:documentId')
  get(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
    @Headers('x-share-token') shareToken?: string,
  ) {
    return this.documents.get(documentId, { userId: user.id, shareToken });
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Patch('documents/:documentId')
  rename(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
    @Body() dto: RenameDocumentDto,
  ) {
    return this.documents.rename(documentId, { userId: user.id }, dto.title);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('documents/:documentId/move')
  move(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
    @Body() dto: MoveDocumentDto,
  ) {
    return this.documents.move(documentId, { userId: user.id }, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Delete('documents/:documentId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
  ) {
    return this.documents.remove(documentId, { userId: user.id });
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('documents/:documentId/publish')
  publish(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
    @Body() dto: PublishDocumentDto,
  ) {
    return this.documents.publish(documentId, { userId: user.id }, dto.published);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('documents/:documentId/shares')
  share(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
    @Body() dto: ShareDocumentDto,
  ) {
    return this.documents.share(documentId, { userId: user.id }, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('documents/:documentId/public-links')
  createPublicLink(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
    @Body() dto: CreatePublicLinkDto,
  ) {
    return this.documents.createPublicLink(
      documentId,
      { userId: user.id },
      user.id,
      dto,
    );
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Get('documents/:documentId/versions')
  listVersions(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
  ) {
    return this.documents.listVersions(documentId, { userId: user.id });
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('documents/:documentId/versions')
  snapshot(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
  ) {
    return this.documents.createSnapshot(documentId, { userId: user.id }, user.id);
  }

  @ApiBearerAuth('JWT-auth')
  @UseGuards(JwtAuthGuard)
  @Post('documents/:documentId/versions/:versionId/restore')
  restore(
    @CurrentUser() user: AuthUser,
    @Param('documentId') documentId: string,
    @Param('versionId') versionId: string,
  ) {
    return this.documents.restoreVersion(
      documentId,
      versionId,
      { userId: user.id },
      user.id,
    );
  }
}
