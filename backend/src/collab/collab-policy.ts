export const COLLAB_PERSISTENCE = {
	SNAPSHOT_INTERVAL_MS: 60000,
	SNAPSHOT_UPDATE_THRESHOLD: 100,
	COMPACT_UPDATE_THRESHOLD: 100,
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
