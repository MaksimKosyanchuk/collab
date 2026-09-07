export const BLOCK_TYPES = [
  'paragraph',
  'heading',
  'list',
  'checkbox',
  'image',
  'code',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export type EditorBlock = {
  id: string;
  type: BlockType;
  text: string;
  level?: number;
  checked?: boolean;
  src?: string;
  language?: string;
  items?: string[];
};

export type PresenceUser = {
  userId: string;
  displayName: string;
  color: string;
  cursor: { blockId: string; offset: number } | null;
};

export type ConnState =
  | 'connecting'
  | 'online'
  | 'offline'
  | 'deleted'
  | 'revoked';

export function wsBase(): string {
  return process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/collab';
}
