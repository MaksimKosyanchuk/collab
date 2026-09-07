'use client';

import { RouteError } from '@/components/route-state';

export default function RootError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<main className="mx-auto max-w-3xl px-5 py-16">
			<p className="brand text-2xl">Collab Docs</p>
			<div className="mt-8">
				<RouteError
					title="Page failed to load"
					message={error.message}
					reset={reset}
					homeHref="/"
					homeLabel="Home"
				/>
			</div>
		</main>
	);
}
