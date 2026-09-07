'use client';

import Link from 'next/link';

export function RouteError({
	title,
	message,
	reset,
	homeHref = '/app',
	homeLabel = 'Back to app',
}: {
	title: string;
	message?: string;
	reset: () => void;
	homeHref?: string;
	homeLabel?: string;
}) {
	return (
		<div className="mx-auto max-w-lg panel p-6">
			<p className="text-[11px] uppercase tracking-wide text-muted">Error</p>
			<h1 className="mt-1 text-base font-semibold">{title}</h1>
			<p className="error mt-2">{message?.trim() || 'Something went wrong. Try again.'}</p>
			<div className="mt-4 flex flex-wrap gap-2">
				<button type="button" className="btn btn-primary" onClick={reset}>
					Try again
				</button>
				<Link href={homeHref} className="btn btn-ghost">
					{homeLabel}
				</Link>
			</div>
		</div>
	);
}

export function RouteLoading({ label }: { label: string }) {
	return <div className="mx-auto max-w-5xl panel empty p-4 text-[13px]">{label}</div>;
}
