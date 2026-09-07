'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import {
	BLOCK_TYPES,
	type BlockType,
	type ConnState,
	type EditorBlock,
	type PresenceUser,
	wsBase,
} from '@/lib/blocks';

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	bytes.forEach((b) => {
		binary += String.fromCharCode(b);
	});
	return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
	const binary = atob(value);
	const out = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i += 1) {
		out[i] = binary.charCodeAt(i);
	}
	return out;
}

function asBlocks(ydoc: Y.Doc): EditorBlock[] {
	const raw = ydoc.getArray('blocks').toJSON() as unknown[];
	return raw
		.filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
		.map((row) => {
			const type = String(row.type ?? 'paragraph') as BlockType;
			return {
				id: String(row.id ?? ''),
				type: (BLOCK_TYPES as readonly string[]).includes(type) ? type : 'paragraph',
				text: String(row.text ?? ''),
				level: typeof row.level === 'number' ? row.level : undefined,
				checked: typeof row.checked === 'boolean' ? row.checked : undefined,
				src: row.src ? String(row.src) : undefined,
				language: row.language ? String(row.language) : undefined,
				items: Array.isArray(row.items)
					? row.items.map((entry) => String(entry))
					: undefined,
			};
		});
}

function findBlockMap(ydoc: Y.Doc, blockId: string): Y.Map<unknown> | null {
	const blocks = ydoc.getArray('blocks');
	for (let i = 0; i < blocks.length; i += 1) {
		const item = blocks.get(i);
		if (item instanceof Y.Map && item.get('id') === blockId) {
			return item;
		}
	}
	return null;
}

export function useCollabDoc(documentId: string, shareToken?: string | null) {
	const ydocRef = useRef<Y.Doc | null>(null);
	const socketRef = useRef<WebSocket | null>(null);
	const deletedRef = useRef(false);
	const applyingRemote = useRef(false);
	const [title, setTitle] = useState('Untitled');
	const [blocks, setBlocks] = useState<EditorBlock[]>([]);
	const [presence, setPresence] = useState<PresenceUser[]>([]);
	const [localUserId, setLocalUserId] = useState<string | null>(null);
	const [canEdit, setCanEdit] = useState(false);
	const [conn, setConn] = useState<ConnState>('connecting');
	const [browserOnline, setBrowserOnline] = useState(true);

	const refreshLocal = useCallback(() => {
		const ydoc = ydocRef.current;
		if (!ydoc) return;
		setTitle(String(ydoc.getMap('meta').get('title') ?? 'Untitled'));
		setBlocks(asBlocks(ydoc));
	}, []);

	useEffect(() => {
		const onOnline = () => setBrowserOnline(true);
		const onOffline = () => setBrowserOnline(false);
		setBrowserOnline(typeof navigator !== 'undefined' ? navigator.onLine : true);
		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);
		return () => {
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
		};
	}, []);

	useEffect(() => {
		let cancelled = false;
		deletedRef.current = false;
		setLocalUserId(null);
		const ydoc = new Y.Doc();
		ydocRef.current = ydoc;

		const onDocUpdate = (update: Uint8Array, origin: unknown) => {
			if (origin === 'remote' || applyingRemote.current) return;
			const socket = socketRef.current;
			if (!socket || socket.readyState !== WebSocket.OPEN) return;
			socket.send(
				JSON.stringify({
					type: 'update',
					update: toBase64(update),
				}),
			);
		};
		ydoc.on('update', onDocUpdate);
		ydoc.on('update', refreshLocal);

		async function connect() {
			if (cancelled || deletedRef.current) return;
			setConn('connecting');
			let accessToken: string | null = null;
			try {
				const tokenRes = await fetch('/api/auth/ws-token', {
					cache: 'no-store',
				});
				if (tokenRes.ok) {
					const body = (await tokenRes.json()) as { accessToken: string };
					accessToken = body.accessToken;
				}
			} catch {
				// Fall through — may still join with shareToken.
			}
			if (!accessToken && !shareToken) {
				if (!cancelled && !deletedRef.current) {
					setConn('offline');
					scheduleReconnect();
				}
				return;
			}
			if (cancelled || deletedRef.current) return;

			const url = new URL(wsBase());
			url.searchParams.set('documentId', documentId);
			if (accessToken) {
				url.searchParams.set('token', accessToken);
			}
			if (shareToken) {
				url.searchParams.set('shareToken', shareToken);
			}
			const socket = new WebSocket(url.toString());
			socketRef.current = socket;

			socket.onopen = () => {
				if (!cancelled && !deletedRef.current) setConn('online');
			};
			socket.onclose = () => {
				if (cancelled || deletedRef.current) return;
				setConn('offline');
				scheduleReconnect();
			};
			socket.onerror = () => {
				if (!cancelled && !deletedRef.current) setConn('offline');
			};
			socket.onmessage = (event) => {
				let message: Record<string, unknown>;
				try {
					message = JSON.parse(String(event.data)) as Record<string, unknown>;
				} catch {
					return;
				}
				if (message.type === 'document_deleted') {
					deletedRef.current = true;
					setConn('deleted');
					socket.close();
					return;
				}
				if (message.type === 'access_revoked') {
					deletedRef.current = true;
					setConn('revoked');
					setCanEdit(false);
					socket.close();
					return;
				}
				if (message.type === 'access' && typeof message.canEdit === 'boolean') {
					setCanEdit(message.canEdit);
					return;
				}
				if (message.type === 'sync' || message.type === 'update') {
					const updateB64 = String(message.update ?? '');
					if (!updateB64) return;
					applyingRemote.current = true;
					Y.applyUpdate(ydoc, fromBase64(updateB64), 'remote');
					applyingRemote.current = false;
					if (message.type === 'sync') {
						if (typeof message.canEdit === 'boolean') {
							setCanEdit(message.canEdit);
						}
						if (typeof message.userId === 'string') {
							setLocalUserId(message.userId);
						}
					}
					refreshLocal();
					return;
				}
				if (message.type === 'presence' && Array.isArray(message.users)) {
					setPresence(message.users as PresenceUser[]);
				}
				if (message.type === 'error' && message.code === 'FORBIDDEN') {
					setCanEdit(false);
				}
			};
		}

		let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
		function scheduleReconnect() {
			if (cancelled || deletedRef.current || reconnectTimer) return;
			reconnectTimer = setTimeout(() => {
				reconnectTimer = null;
				if (cancelled || deletedRef.current) return;
				if (typeof navigator !== 'undefined' && !navigator.onLine) {
					scheduleReconnect();
					return;
				}
				void connect();
			}, 1500);
		}

		void connect();

		const onOnline = () => {
			if (cancelled || deletedRef.current) return;
			if (socketRef.current?.readyState === WebSocket.OPEN) return;
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
				reconnectTimer = null;
			}
			void connect();
		};
		window.addEventListener('online', onOnline);

		return () => {
			cancelled = true;
			window.removeEventListener('online', onOnline);
			if (reconnectTimer) clearTimeout(reconnectTimer);
			ydoc.off('update', onDocUpdate);
			ydoc.off('update', refreshLocal);
			socketRef.current?.close();
			socketRef.current = null;
			ydoc.destroy();
			ydocRef.current = null;
		};
	}, [documentId, shareToken, refreshLocal]);

	const updateTitle = useCallback(
		(next: string) => {
			if (!canEdit) return;
			ydocRef.current?.getMap('meta').set('title', next);
		},
		[canEdit],
	);

	const updateBlock = useCallback(
		(blockId: string, patch: Partial<EditorBlock>) => {
			if (!canEdit) return;
			const ydoc = ydocRef.current;
			if (!ydoc) return;
			const map = findBlockMap(ydoc, blockId);
			if (!map) return;
			ydoc.transact(() => {
				for (const [key, value] of Object.entries(patch)) {
					if (key === 'id' || value === undefined) continue;
					map.set(key, value);
				}
			});
		},
		[canEdit],
	);

	const addBlock = useCallback(
		(type: BlockType, afterId?: string) => {
			if (!canEdit) return;
			const ydoc = ydocRef.current;
			if (!ydoc) return;
			const blocksArr = ydoc.getArray('blocks');
			const map = new Y.Map();
			map.set('id', crypto.randomUUID());
			map.set('type', type);
			map.set('text', '');
			if (type === 'heading') map.set('level', 2);
			if (type === 'checkbox') map.set('checked', false);
			if (type === 'list') map.set('items', ['']);
			if (type === 'code') map.set('language', 'ts');
			if (type === 'image') map.set('src', '');

			let index = blocksArr.length;
			if (afterId) {
				for (let i = 0; i < blocksArr.length; i += 1) {
					const item = blocksArr.get(i);
					if (item instanceof Y.Map && item.get('id') === afterId) {
						index = i + 1;
						break;
					}
				}
			}
			blocksArr.insert(index, [map]);
		},
		[canEdit],
	);

	const removeBlock = useCallback(
		(blockId: string) => {
			if (!canEdit) return;
			const ydoc = ydocRef.current;
			if (!ydoc) return;
			const blocksArr = ydoc.getArray('blocks');
			for (let i = 0; i < blocksArr.length; i += 1) {
				const item = blocksArr.get(i);
				if (item instanceof Y.Map && item.get('id') === blockId) {
					blocksArr.delete(i, 1);
					break;
				}
			}
		},
		[canEdit],
	);

	const setCursor = useCallback((blockId: string, offset: number) => {
		const socket = socketRef.current;
		if (!socket || socket.readyState !== WebSocket.OPEN) return;
		socket.send(JSON.stringify({ type: 'cursor', blockId, offset }));
	}, []);

	return {
		title,
		blocks,
		presence,
		localUserId,
		canEdit,
		conn,
		browserOnline,
		updateTitle,
		updateBlock,
		addBlock,
		removeBlock,
		setCursor,
	};
}
