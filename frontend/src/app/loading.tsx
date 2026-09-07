import { RouteLoading } from '@/components/route-state';
export default function RootLoading() {
	return (
		<main className="mx-auto max-w-3xl px-5 py-16">
			<RouteLoading label="Loading…" />
		</main>
	);
}
