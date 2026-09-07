export type AuthUser = {
  id: string;
  email: string;
  displayName: string;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  plan: 'FREE' | 'PRO' | 'TEAM';
  storageUsedBytes: string;
  createdAt: string;
};

export type DocumentTreeItem = {
  id: string;
  parentId: string | null;
  title: string;
  rank: string;
  publicationStatus: 'UNPUBLISHED' | 'PUBLISHED';
  updatedAt: string;
};

export type DocumentAccess = 'VIEW' | 'EDIT' | 'MANAGE';

export type WorkspaceMember = {
  id: string;
  workspaceId: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'EDITOR' | 'VIEWER';
  user: {
    id: string;
    email: string;
    displayName: string;
  };
};

export type DocumentShare = {
  id: string;
  documentId: string;
  userId: string;
  access: DocumentAccess;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
};

export type DocumentPublicLinkMeta = {
  id: string;
  tokenPrefix: string;
  access: DocumentAccess;
  expiresAt: string | null;
  createdAt: string;
};

export type DocumentDetail = {
  id: string;
  workspaceId: string;
  title: string;
  publicationStatus: 'UNPUBLISHED' | 'PUBLISHED';
  publicSlug: string | null;
  publishedAt: string | null;
  access: number;
  shares: DocumentShare[];
  publicLinks: DocumentPublicLinkMeta[];
};

export type PublishedDocument = {
  id: string;
  title: string;
  description: string;
  blocks: Array<{
    id: string;
    type: string;
    text: string;
    level?: number;
    checked?: boolean;
    src?: string;
    language?: string;
    items?: string[];
  }>;
  updatedAt: string;
};

export type ApiErrorBody = {
  statusCode?: number;
  message?: string | string[];
  code?: string;
};
