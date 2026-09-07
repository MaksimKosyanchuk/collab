'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { messageFromUnknown } from '@/lib/errors';

type SearchHit = {
	id: string;
	title: string;
	plainText?: string;
};

export function WorkspaceSearch({ workspaceId }: { workspaceId: string }) {
	const [query, setQuery] = useState('');
	const [debounced, setDebounced] = useState('');
	const [hits, setHits] = useState<SearchHit[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		const timer = window.setTimeout(() => setDebounced(query.trim()), 300);
		return () => window.clearTimeout(timer);
	}, [query]);

	useEffect(() => {
		if (!debounced) {
			setHits([]);
			setError(null);
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);
		setError(null);

		const params = new URLSearchParams({
			workspaceId,
			q: debounced,
		});

		fetch(`/api/search?${params.toString()}`)
			.then(async (res) => {
				const body = await res.json();
				if (!res.ok) {
					throw new Error(
						typeof body?.message === 'string' ? body.message : 'Search failed',
					);
				}
				return body as SearchHit[];
			})
			.then((data) => {
				if (!cancelled) {
					setHits(Array.isArray(data) ? data : []);
				}
			})
			.catch((err) => {
				if (!cancelled) {
					setHits([]);
					setError(messageFromUnknown(err, 'Search failed'));
				}
			})
			.finally(() => {
				if (!cancelled) setLoading(false);
			});

		return () => {
			cancelled = true;
		};
	}, [debounced, workspaceId]);

	return (
		<div className="mt-3 space-y-2 border-t border-line pt-3">
			<label className="block">
				<span className="mb-1 block text-[11px] uppercase tracking-wide text-muted">
					Search
				</span>
				<input
					className="field"
					value={query}
					onChange={(event) => setQuery(event.target.value)}
					placeholder="Search pages…"
					autoComplete="off"
				/>
			</label>
			{loading ? <p className="text-[12px] text-muted">Searching…</p> : null}
			{error ? <p className="text-[12px] text-danger">{error}</p> : null}
			{!loading && debounced && hits.length === 0 && !error ? (
				<p className="empty">No results</p>
			) : null}
			{hits.length > 0 ? (
				<ul className="space-y-1">
					{hits.map((hit) => (
						<li key={hit.id}>
							<Link
								href={`/app/w/${workspaceId}/d/${hit.id}`}
								className="block truncate rounded-md px-2 py-1.5 text-[13px] hover:bg-line/60"
							>
								{hit.title || 'Untitled'}
							</Link>
						</li>
					))}
				</ul>
			) : null}
		</div>
	);
}
