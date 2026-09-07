import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessModule } from '../access/access.module';
import { OutboxService } from '../queue/outbox.service';
import { CollabControlServer } from './collab-control.server';
import { CollabGateway } from './collab.gateway';
import { CollabHealthController } from './collab-health.controller';
import { CollabPersistenceModule } from './collab-persistence.module';
import { CollabRoomsService } from './collab-rooms.service';
@Module({
	imports: [JwtModule.register({}), AccessModule, CollabPersistenceModule],
	controllers: [CollabHealthController],
	providers: [OutboxService, CollabRoomsService, CollabGateway, CollabControlServer],
	exports: [CollabPersistenceModule, CollabRoomsService],
})
export class CollabModule {}
