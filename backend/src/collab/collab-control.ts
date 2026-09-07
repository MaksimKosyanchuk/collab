export const COLLAB_CONTROL = Symbol('COLLAB_CONTROL');
export type CollabControlCommand =
	| {
			op: 'flushProjection';
			documentId: string;
			requestId: string;
	  }
	| {
			op: 'closeDeleted';
			documentId: string;
			requestId: string;
	  }
	| {
			op: 'reload';
			documentId: string;
			requestId: string;
	  }
	| {
			op: 'revalidateUserOnDocument';
			documentId: string;
			userId: string;
			requestId: string;
	  }
	| {
			op: 'revalidateAllClientsOnDocument';
			documentId: string;
			requestId: string;
	  }
	| {
			op: 'revalidateUserInWorkspace';
			workspaceId: string;
			userId: string;
			requestId: string;
	  };
export type CollabControlReply = {
	requestId: string;
	ok: boolean;
	error?: string;
};
export interface CollabControl {
	flushProjection(documentId: string): Promise<void>;
	closeDeleted(documentId: string): Promise<void>;
	reload(documentId: string): Promise<void>;
	revalidateUserOnDocument(documentId: string, userId: string): Promise<void>;
	revalidateAllClientsOnDocument(documentId: string): Promise<void>;
	revalidateUserInWorkspace(workspaceId: string, userId: string): Promise<void>;
}
