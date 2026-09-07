export function slugify(value: string, suffix: string): string {
	const base =
		value
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'item';
	return `${base}-${suffix}`;
}
export function nextRank(previous?: string | null): string {
	if (!previous) {
		return 'a0';
	}
	const match = /^(.*)(\d+)$/.exec(previous);
	if (!match) {
		return `${previous}0`;
	}
	return `${match[1]}${Number(match[2]) + 1}`;
}
