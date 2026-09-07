import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CollabGateway } from './collab.gateway';
import { CollabPersistenceService } from './collab-persistence.service';
import { CollabRoomsService } from './collab-rooms.service';

@Module({
  imports: [JwtModule.register({})],
  providers: [CollabPersistenceService, CollabRoomsService, CollabGateway],
  exports: [CollabPersistenceService, CollabRoomsService],
})
export class CollabModule {}
