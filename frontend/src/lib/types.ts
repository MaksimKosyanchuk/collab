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

export type WorkspaceSubscription = {
	id: string;
	workspaceId: string;
	plan: 'FREE' | 'PRO' | 'TEAM';
	status: string;
	currentPeriodEnd: string | null;
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

export type WorkspaceRole = WorkspaceMember['role'];

export type WorkspaceInvitation = {
	id: string;
	email: string;
	role: Exclude<WorkspaceRole, 'OWNER'>;
	expiresAt: string;
	createdAt: string;
};

export type WorkspaceDetail = Workspace & {
	members: WorkspaceMember[];
	invitations: WorkspaceInvitation[];
	myRole: WorkspaceRole | null;
	subscription?: WorkspaceSubscription | null;
};

export type SharedDocumentItem = {
	shareId: string;
	access: DocumentAccess;
	documentId: string;
	title: string;
	workspaceId: string;
	workspaceName: string;
	workspaceSlug: string;
	publicationStatus: 'UNPUBLISHED' | 'PUBLISHED';
	updatedAt: string;
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

export type DocumentShareInvitation = {
	id: string;
	email: string;
	access: DocumentAccess;
	expiresAt: string;
	createdAt: string;
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
	shareInvitations?: DocumentShareInvitation[];
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

export type DocumentVersion = {
	id: string;
	title: string;
	trigger: string;
	createdAt: string;
	createdById?: string | null;
};

export type AssetPresign = {
	objectKey: string;
	uploadUrl: string;
	bucket: string;
};

export type AssetConfirm = {
	id: string;
	objectKey: string;
	mimeType: string;
	sizeBytes: number;
	url: string;
};

export type ApiErrorBody = {
	statusCode?: number;
	message?: string | string[];
	code?: string;
};
