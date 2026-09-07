describe('CollabRoomsService.closeDeleted', () => {
	it('broadcasts document_deleted, closes sockets, and drops the room', () => {
		const sent: string[] = [];
		const closed: Array<{
			code?: number;
			reason?: string;
		}> = [];
		const socket = {
			readyState: 1,
			send: (data: string) => {
				sent.push(data);
			},
			close: (code?: number, reason?: string) => {
				closed.push({ code, reason });
			},
		};
		const service = {
			rooms: new Map<
				string,
				{
					documentId: string;
					ydoc: {
						destroy: () => void;
					};
					clients: Set<{
						socket: typeof socket;
					}>;
					closed: boolean;
					persistTimer?: NodeJS.Timeout;
				}
			>(),
			peek(documentId: string) {
				const room = this.rooms.get(documentId);
				return room && !room.closed ? room : undefined;
			},
			closeDeleted(documentId: string) {
				const room = this.rooms.get(documentId);
				if (!room) {
					return;
				}
				room.closed = true;
				if (room.persistTimer) {
					clearTimeout(room.persistTimer);
					room.persistTimer = undefined;
				}
				const payload = JSON.stringify({
					type: 'document_deleted',
					documentId,
				});
				for (const client of room.clients) {
					if (client.socket.readyState === 1) {
						client.socket.send(payload);
					}
					client.socket.close(4404, 'Document deleted');
				}
				room.clients.clear();
				room.ydoc.destroy();
				this.rooms.delete(documentId);
			},
		};
		const destroyed = { value: false };
		service.rooms.set('doc-1', {
			documentId: 'doc-1',
			ydoc: {
				destroy: () => {
					destroyed.value = true;
				},
			},
			clients: new Set([{ socket }]),
			closed: false,
		});
		service.closeDeleted('doc-1');
		expect(JSON.parse(sent[0])).toEqual({
			type: 'document_deleted',
			documentId: 'doc-1',
		});
		expect(closed[0]).toEqual({ code: 4404, reason: 'Document deleted' });
		expect(destroyed.value).toBe(true);
		expect(service.peek('doc-1')).toBeUndefined();
	});
});
