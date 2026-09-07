import { Global, Module } from '@nestjs/common';
import { COLLAB_CONTROL } from './collab-control';
import { CollabControlClient } from './collab-control.client';

/** API-side collab bridge: Redis commands to the collab gateway process. */
@Global()
@Module({
	providers: [CollabControlClient, { provide: COLLAB_CONTROL, useExisting: CollabControlClient }],
	exports: [COLLAB_CONTROL, CollabControlClient],
})
export class CollabApiModule {}
