import { Module } from '@nestjs/common';
import { CollabPersistenceService } from './collab-persistence.service';
@Module({
	providers: [CollabPersistenceService],
	exports: [CollabPersistenceService],
})
export class CollabPersistenceModule {}
