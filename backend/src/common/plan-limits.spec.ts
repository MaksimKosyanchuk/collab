import { PLAN_LIMITS } from './plan-limits';
describe('PLAN_LIMITS', () => {
	it('caps Free below Pro below Team', () => {
		expect(PLAN_LIMITS.FREE.members).toBeLessThan(PLAN_LIMITS.PRO.members);
		expect(PLAN_LIMITS.PRO.documents).toBeLessThan(PLAN_LIMITS.TEAM.documents);
		expect(PLAN_LIMITS.FREE.storageBytes).toBeLessThan(PLAN_LIMITS.PRO.storageBytes);
	});
});
