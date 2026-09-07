import { expect, test } from '@playwright/test';
import {
  API,
  createDocument,
  createWorkspace,
  publishDocument,
  registerUser,
  setAuthCookies,
} from './helpers/api';

test.describe('TZ: publish → public SSR/ISR page', () => {
  test('/p/[slug] renders published content and refreshes after edit', async ({
    page,
    request,
    context,
    baseURL,
  }) => {
    const owner = await registerUser(request, 'publisher');
    const workspace = await createWorkspace(
      request,
      owner.tokens.accessToken,
      `PW Pub ${Date.now()}`,
    );
    const document = await createDocument(
      request,
      owner.tokens.accessToken,
      workspace.id,
      'Draft SSR',
    );

    await setAuthCookies(context, owner.tokens, baseURL!);
    await page.goto(`/app/w/${workspace.id}/d/${document.id}`);

    await expect(page.getByPlaceholder('Untitled')).toBeEnabled({
      timeout: 20_000,
    });

    const title = page.getByPlaceholder('Untitled');
    await title.fill('SSR Live Title');

    const body = page.locator('textarea.field').first();
    await body.fill('Hello from published SSR page');
    await page.waitForTimeout(1000);

    await page.getByRole('button', { name: 'Publish page' }).click();
    await expect(
      page.getByText(/Published from the live document|Published\./),
    ).toBeVisible({ timeout: 15_000 });

    const published = await publishDocument(
      request,
      owner.tokens.accessToken,
      document.id,
    );
    expect(published.publicSlug).toBeTruthy();
    const slug = published.publicSlug;

    const publicCtx = await context.browser()!.newContext();
    const publicPage = await publicCtx.newPage();
    await publicPage.goto(`/p/${slug}`);
    await expect(publicPage.getByRole('heading', { level: 1 })).toHaveText(
      'SSR Live Title',
    );
    await expect(
      publicPage.getByText('Hello from published SSR page'),
    ).toBeVisible();

    await title.fill('SSR After Edit');
    await body.fill('Fresh ISR body');
    await page.waitForTimeout(1000);
    // Publish again forces flushProjection + revalidate outbox.
    await publishDocument(request, owner.tokens.accessToken, document.id);
    await page.waitForTimeout(4500);

    await publicPage.goto(`/p/${slug}`);
    await expect(publicPage.getByRole('heading', { level: 1 })).toHaveText(
      'SSR After Edit',
    );
    await expect(publicPage.getByText('Fresh ISR body')).toBeVisible();

    const apiDoc = await request.get(`${API}/public/documents/${slug}`);
    expect(apiDoc.ok()).toBeTruthy();
    const json = (await apiDoc.json()) as { title: string };
    expect(json.title).toBe('SSR After Edit');

    await publicCtx.close();
  });
});
