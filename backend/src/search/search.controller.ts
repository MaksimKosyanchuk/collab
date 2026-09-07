import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../auth/current-user.decorator';
import { SearchService } from './search.service';

@ApiTags('search')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
	constructor(private readonly search: SearchService) {}

	@Get()
	@ApiOperation({ summary: 'Search documents in a workspace' })
	@ApiQuery({ name: 'workspaceId', required: true, description: 'Workspace ID' })
	@ApiQuery({ name: 'q', required: true, description: 'Search query' })
	query(
		@CurrentUser() user: AuthUser,
		@Query('workspaceId') workspaceId: string,
		@Query('q') q: string,
	) {
		return this.search.search(workspaceId, user.id, q);
	}
}
