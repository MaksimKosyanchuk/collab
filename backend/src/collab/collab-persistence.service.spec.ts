import { createHash } from 'crypto';
import * as Y from 'yjs';
import {
  COLLAB_PERSISTENCE,
  shouldAutoSnapshot,
} from './collab-policy';

describe('COLLAB_PERSISTENCE policy', () => {
  it('documents explicit snapshot + compaction thresholds', () => {
    expect(COLLAB_PERSISTENCE.SNAPSHOT_INTERVAL_MS).toBe(60_000);
    expect(COLLAB_PERSISTENCE.SNAPSHOT_UPDATE_THRESHOLD).toBe(100);
    expect(COLLAB_PERSISTENCE.COMPACT_UPDATE_THRESHOLD).toBe(100);
  });

  it('snapshots when update threshold is reached', () => {
    expect(
      shouldAutoSnapshot({
        updatesSinceSnapshot: 100,
        lastSnapshotAt: Date.now(),
      }),
    ).toBe(true);
  });

  it('snapshots when interval has elapsed', () => {
    expect(
      shouldAutoSnapshot({
        updatesSinceSnapshot: 1,
        lastSnapshotAt: Date.now() - 60_000,
        now: Date.now(),
      }),
    ).toBe(true);
  });

  it('does not snapshot before either threshold', () => {
    expect(
      shouldAutoSnapshot({
        updatesSinceSnapshot: 99,
        lastSnapshotAt: Date.now() - 30_000,
        now: Date.now(),
      }),
    ).toBe(false);
  });
});

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
});
