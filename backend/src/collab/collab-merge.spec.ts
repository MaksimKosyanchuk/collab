import * as Y from 'yjs';

describe('Yjs concurrent merge', () => {
  it('keeps inserts from two clients', () => {
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
});
