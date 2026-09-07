import * as Y from 'yjs';

function blockMap(id: string, text: string): Y.Map<unknown> {
	const block = new Y.Map<unknown>();
	block.set('id', id);
	block.set('type', 'paragraph');
	block.set('text', text);
	return block;
}

describe('Yjs concurrent merge', () => {
	it('keeps inserts from two clients on shared text', () => {
		const left = new Y.Doc();
		const right = new Y.Doc();
		left.on('update', (update: Uint8Array) => {
			Y.applyUpdate(right, update);
		});
		right.on('update', (update: Uint8Array) => {
			Y.applyUpdate(left, update);
		});

		left.getText('body').insert(0, 'Hello');
		right.getText('body').insert(right.getText('body').length, ' World');

		expect(left.getText('body').toString()).toBe('Hello World');
		expect(right.getText('body').toString()).toBe('Hello World');
	});

	it('keeps concurrent block edits from two clients without lost updates', () => {
		const left = new Y.Doc();
		const right = new Y.Doc();

		left.on('update', (update: Uint8Array) => {
			Y.applyUpdate(right, update);
		});
		right.on('update', (update: Uint8Array) => {
			Y.applyUpdate(left, update);
		});

		// Shared baseline: one empty paragraph each client starts from.
		left.getMap('meta').set('title', 'Shared');
		left.getArray('blocks').push([blockMap('b1', '')]);

		// Concurrent divergent edits on different blocks / fields.
		left.getMap('meta').set('title', 'Left title');
		left.getArray('blocks').push([blockMap('b-left', 'from left')]);

		right.getArray('blocks').push([blockMap('b-right', 'from right')]);

		const leftBlocks = left.getArray('blocks').toJSON() as Array<{
			id: string;
			text: string;
		}>;
		const rightBlocks = right.getArray('blocks').toJSON() as Array<{
			id: string;
			text: string;
		}>;

		expect(left.getMap('meta').get('title')).toBe('Left title');
		expect(right.getMap('meta').get('title')).toBe('Left title');

		const leftIds = leftBlocks.map((b) => b.id).sort();
		const rightIds = rightBlocks.map((b) => b.id).sort();
		expect(leftIds).toEqual(rightIds);
		expect(leftIds).toEqual(['b-left', 'b-right', 'b1'].sort());
		expect(leftBlocks.find((b) => b.id === 'b-left')?.text).toBe('from left');
		expect(leftBlocks.find((b) => b.id === 'b-right')?.text).toBe('from right');
	});

	it('applies the same update twice without changing state (replay-safe)', () => {
		const doc = new Y.Doc();
		doc.getMap('meta').set('title', 'A');
		const update = Y.encodeStateAsUpdate(doc);

		const other = new Y.Doc();
		Y.applyUpdate(other, update);
		Y.applyUpdate(other, update);

		expect(other.getMap('meta').get('title')).toBe('A');
		other.destroy();
		doc.destroy();
	});
});
