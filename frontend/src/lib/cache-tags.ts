/** Shared cache tags — safe to import from Server Actions and RSC. */
export function workspaceTreeTag(workspaceId: string): string {
	return `workspace-tree:${workspaceId}`;
}
