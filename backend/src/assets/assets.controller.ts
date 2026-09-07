import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { AssetsService } from './assets.service';
import { ConfirmAssetDto, PresignAssetDto } from './dto/asset.dto';

@ApiTags('assets')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('workspaces/:workspaceId/assets')
export class AssetsController {
	constructor(private readonly assets: AssetsService) {}

	@Post('presign')
	@ApiOperation({ summary: 'Presign an asset upload URL' })
	@ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
	presign(
		@CurrentUser() user: AuthUser,
		@Param('workspaceId') workspaceId: string,
		@Body() dto: PresignAssetDto,
	) {
		return this.assets.presign(workspaceId, user.id, dto);
	}

	@Post('confirm')
	@ApiOperation({ summary: 'Confirm an uploaded asset' })
	@ApiParam({ name: 'workspaceId', description: 'Workspace ID' })
	confirm(
		@CurrentUser() user: AuthUser,
		@Param('workspaceId') workspaceId: string,
		@Body() dto: ConfirmAssetDto,
	) {
		return this.assets.confirm(workspaceId, user.id, dto);
	}
}
