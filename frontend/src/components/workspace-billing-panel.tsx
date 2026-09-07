'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { changeWorkspacePlanAction } from '@/lib/actions';
import { PLAN_LIMITS, formatStorage, type PlanTier } from '@/lib/plan-limits';
import type { WorkspaceRole, WorkspaceSubscription } from '@/lib/types';

const PLANS: PlanTier[] = ['FREE', 'PRO', 'TEAM'];

export function WorkspaceBillingPanel({
	workspaceId,
	plan: initialPlan,
	storageUsedBytes,
	subscription,
	myRole,
}: {
	workspaceId: string;
	plan: PlanTier;
	storageUsedBytes: string;
	subscription?: WorkspaceSubscription | null;
	myRole: WorkspaceRole | null;
}) {
	const canManage = myRole === 'OWNER' || myRole === 'ADMIN';
	const router = useRouter();
	const [plan, setPlan] = useState(initialPlan);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [pending, startTransition] = useTransition();
	const limits = PLAN_LIMITS[plan];
	const used = Number(storageUsedBytes || '0');

	return (
		<section className="panel rounded-[1.5rem] p-6">
			<h2 className="text-lg font-semibold">Billing</h2>
			<p className="mt-1 text-sm text-muted">
				Mock Stripe-like checkout. Paid plans call an idempotent webhook.
			</p>

			<div className="mt-5 rounded-xl border border-line bg-white/60 px-4 py-3">
				<p className="text-sm text-muted">Current plan</p>
				<p className="text-xl font-semibold">{plan}</p>
				<p className="mt-2 text-sm text-muted">
					Up to {limits.members} members · {limits.documents} docs ·{' '}
					{formatStorage(limits.storageBytes)} storage
				</p>
				<p className="mt-1 text-sm text-muted">
					Used storage: {formatStorage(used)}
					{subscription?.currentPeriodEnd
						? ` · period ends ${new Date(subscription.currentPeriodEnd).toLocaleDateString()}`
						: ''}
				</p>
			</div>

			{canManage ? (
				<div className="mt-5 grid gap-2">
					{PLANS.map((next) => {
						const nextLimits = PLAN_LIMITS[next];
						const isCurrent = next === plan;
						return (
							<button
								key={next}
								type="button"
								className={`btn w-full justify-between ${isCurrent ? 'btn-ghost' : 'btn-primary'}`}
								disabled={pending || isCurrent}
								onClick={() => {
									setError(null);
									setMessage(null);
									startTransition(async () => {
										const result = await changeWorkspacePlanAction(
											workspaceId,
											next,
										);
										if (!result.ok) {
											setError(result.error);
											return;
										}
										setPlan(result.data.plan);
										setMessage(
											next === 'FREE'
												? 'Downgraded to Free.'
												: `Mock payment completed · plan ${next}${
														result.data.duplicateWebhook
															? ' (webhook replay ignored)'
															: ''
													}.`,
										);
										router.refresh();
									});
								}}
							>
								<span>{isCurrent ? `On ${next}` : `Switch to ${next}`}</span>
								<span className="text-xs font-normal opacity-80">
									{nextLimits.members} mem / {nextLimits.documents} docs
								</span>
							</button>
						);
					})}
				</div>
			) : (
				<p className="mt-4 text-sm text-muted">
					Only workspace admins can change the plan.
				</p>
			)}

			{message ? <p className="mt-4 text-sm text-accent">{message}</p> : null}
			{error ? <p className="error mt-4">{error}</p> : null}
		</section>
	);
}
