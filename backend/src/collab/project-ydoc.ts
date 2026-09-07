import sanitizeHtml from 'sanitize-html';
import * as Y from 'yjs';
import { isBlockType, ProjectedBlock } from './block-schema';

const strip = { allowedTags: [] as string[], allowedAttributes: {} };

function clean(value: unknown): string {
	return sanitizeHtml(String(value ?? ''), strip);
}

export function projectYDoc(ydoc: Y.Doc): {
	title: string;
	description: string;
	blocks: ProjectedBlock[];
	plainText: string;
} {
	const meta = ydoc.getMap('meta');
	const title = clean(meta.get('title') ?? 'Untitled');
	const description = clean(meta.get('description') ?? '');
	const raw = ydoc.getArray('blocks').toJSON() as unknown[];
	const blocks: ProjectedBlock[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') {
			continue;
		}
		const row = item as Record<string, unknown>;
		const type = String(row.type ?? 'paragraph');
		if (!isBlockType(type)) {
			continue;
		}
		blocks.push({
			id: clean(row.id ?? ''),
			type,
			text: clean(row.text ?? ''),
			level: typeof row.level === 'number' ? row.level : undefined,
			checked: typeof row.checked === 'boolean' ? row.checked : undefined,
			src: row.src ? clean(row.src) : undefined,
			language: row.language ? clean(row.language) : undefined,
			items: Array.isArray(row.items) ? row.items.map((entry) => clean(entry)) : undefined,
		});
	}
	const plainText = [title, ...blocks.map((block) => block.text)].filter(Boolean).join('\n');
	return { title, description, blocks, plainText };
}
