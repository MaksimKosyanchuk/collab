'use client';

import { RouteError } from '@/components/route-state';

export default function AppError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	return (
		<RouteError
			title="App error"
			message={error.message}
			reset={reset}
			homeHref="/app"
			homeLabel="Workspaces"
		/>
	);
}
