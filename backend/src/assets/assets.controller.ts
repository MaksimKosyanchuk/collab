import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
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
  presign(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: PresignAssetDto,
  ) {
    return this.assets.presign(workspaceId, user.id, dto);
  }

  @Post('confirm')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('workspaceId') workspaceId: string,
    @Body() dto: ConfirmAssetDto,
  ) {
    return this.assets.confirm(workspaceId, user.id, dto);
  }
}
