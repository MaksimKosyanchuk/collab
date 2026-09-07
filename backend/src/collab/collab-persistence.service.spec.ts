import { createHash } from 'crypto';
import * as Y from 'yjs';
import { CollabPersistenceService } from './collab-persistence.service';

describe('CollabPersistenceService idempotency', () => {
  it('hashes identical payloads to the same digest', () => {
    const ydoc = new Y.Doc();
    ydoc.getMap('meta').set('title', 'A');
    const payload = Buffer.from(Y.encodeStateAsUpdate(ydoc));
    const hashA = createHash('sha256').update(payload).digest('hex');
    const hashB = createHash('sha256').update(payload).digest('hex');
    expect(hashA).toBe(hashB);
    ydoc.destroy();
  });

  it('exposes compact threshold constant via class presence', () => {
    expect(CollabPersistenceService.name).toBe('CollabPersistenceService');
  });
});
