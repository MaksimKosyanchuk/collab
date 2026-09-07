import { expect, test } from '@playwright/test';
import {
	acceptInvite,
	createDocument,
	createWorkspace,
	inviteViewer,
	registerUser,
	setAuthCookies,
} from './helpers/api';
test.describe('TZ: Viewer cannot edit in UI', () => {
	test('Viewer sees View only and disabled editor; API edit still blocked', async ({
		page,
		request,
		context,
		baseURL,
	}) => {
		const owner = await registerUser(request, 'owner');
		const viewer = await registerUser(request, 'viewer');
		const workspace = await createWorkspace(
			request,
			owner.tokens.accessToken,
			`PW Viewer WS ${Date.now()}`,
		);
		const document = await createDocument(
			request,
			owner.tokens.accessToken,
			workspace.id,
			'Viewer locked page',
		);
		const invite = await inviteViewer(
			request,
			owner.tokens.accessToken,
			workspace.id,
			viewer.email,
		);
		await acceptInvite(request, viewer.tokens.accessToken, invite.id);
		await setAuthCookies(context, viewer.tokens, baseURL!);
		await page.goto(`/app/w/${workspace.id}/d/${document.id}`);
		await expect(page.getByText('View only')).toBeVisible({ timeout: 20000 });
		await expect(page.getByRole('button', { name: 'Publish page' })).toHaveCount(0);
		const title = page.getByPlaceholder('Untitled');
		await expect(title).toBeDisabled();
		const bodyField = page.locator('textarea.field').first();
		await expect(bodyField).toBeDisabled();
		const api = await request.patch(
			`${process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001'}/documents/${document.id}`,
			{
				headers: { Authorization: `Bearer ${viewer.tokens.accessToken}` },
				data: { title: 'Should fail' },
			},
		);
		expect(api.status()).toBe(403);
	});
});
