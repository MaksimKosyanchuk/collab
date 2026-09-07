import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AccessModule } from '../access/access.module';
import { CollabGateway } from './collab.gateway';
import { CollabPersistenceService } from './collab-persistence.service';
import { CollabRoomsService } from './collab-rooms.service';

@Module({
  imports: [JwtModule.register({}), AccessModule],
  providers: [CollabPersistenceService, CollabRoomsService, CollabGateway],
  exports: [CollabPersistenceService, CollabRoomsService],
})
export class CollabModule {}
