export const BLOCK_TYPES = ['paragraph', 'heading', 'list', 'checkbox', 'image', 'code'] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export type ProjectedBlock = {
	id: string;
	type: BlockType;
	text: string;
	level?: number;
	checked?: boolean;
	src?: string;
	language?: string;
	items?: string[];
};

export function isBlockType(value: string): value is BlockType {
	return (BLOCK_TYPES as readonly string[]).includes(value);
}
