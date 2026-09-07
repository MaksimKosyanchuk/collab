/**
 * Explicit CRDT persistence policy (TZ: snapshot + compaction).
 *
 * Binary Y.Doc state lives in PostgreSQL:
 * - DocumentCollabState.state — compacted BYTEA baseline
 * - DocumentCollabUpdate.payload — incremental updates until compacted
 * - DocumentVersion.state — version-history snapshots (restoreable)
 *
 * Snapshot (version history) when either threshold is met since last snapshot:
 * - SNAPSHOT_UPDATE_THRESHOLD applied updates, OR
 * - SNAPSHOT_INTERVAL_MS elapsed
 *
 * Compaction (fold increments into baseline, delete DocumentCollabUpdate rows)
 * when pending incremental updates reach COMPACT_UPDATE_THRESHOLD.
 */
export const COLLAB_PERSISTENCE = {
	/** Auto version snapshot at least this often while the room is active. */
	SNAPSHOT_INTERVAL_MS: 60_000,
	/** Auto version snapshot after this many applied CRDT updates. */
	SNAPSHOT_UPDATE_THRESHOLD: 100,
	/** Fold increments into DocumentCollabState and drop update rows. */
	COMPACT_UPDATE_THRESHOLD: 100,
	/** Debounce projection/search flush after an update. */
	FLUSH_DEBOUNCE_MS: 750,
} as const;

export function shouldAutoSnapshot(input: {
	updatesSinceSnapshot: number;
	lastSnapshotAt: number;
	now?: number;
}): boolean {
	const now = input.now ?? Date.now();
	return (
		input.updatesSinceSnapshot >= COLLAB_PERSISTENCE.SNAPSHOT_UPDATE_THRESHOLD ||
		now - input.lastSnapshotAt >= COLLAB_PERSISTENCE.SNAPSHOT_INTERVAL_MS
	);
}
