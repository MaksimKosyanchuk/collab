import { Module } from '@nestjs/common';
import { CollabPersistenceModule } from '../collab/collab-persistence.module';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
@Module({
	imports: [CollabPersistenceModule],
	controllers: [DocumentsController],
	providers: [DocumentsService],
	exports: [DocumentsService],
})
export class DocumentsModule {}
