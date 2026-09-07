export type PlanTier = 'FREE' | 'PRO' | 'TEAM';

export type PlanLimits = {
	members: number;
	documents: number;
	storageBytes: number;
};

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
	FREE: {
		members: 3,
		documents: 20,
		storageBytes: 100 * 1024 * 1024,
	},
	PRO: {
		members: 10,
		documents: 200,
		storageBytes: 5 * 1024 * 1024 * 1024,
	},
	TEAM: {
		members: 50,
		documents: 10_000,
		storageBytes: 50 * 1024 * 1024 * 1024,
	},
};

export function formatStorage(bytes: number): string {
	if (bytes >= 1024 * 1024 * 1024) {
		return `${Math.round(bytes / (1024 * 1024 * 1024))} GB`;
	}
	return `${Math.round(bytes / (1024 * 1024))} MB`;
}
