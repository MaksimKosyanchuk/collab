import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WsAdapter } from '@nestjs/platform-ws';
import { randomUUID } from 'crypto';
import { createServer } from 'http';
import request from 'supertest';
import WebSocket from 'ws';
import * as Y from 'yjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { CollabRoomsService } from '../src/collab/collab-rooms.service';
import { AccessLevel } from '../src/access/access.policy';

type Tokens = { accessToken: string; refreshToken: string };

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64');
}

function fromBase64(value: string): Uint8Array {
  return new Uint8Array(Buffer.from(value, 'base64'));
}

async function waitForMessage(
  socket: WebSocket,
  predicate: (msg: Record<string, unknown>) => boolean,
  timeoutMs = 8_000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('WebSocket message timeout'));
    }, timeoutMs);

    function onMessage(raw: WebSocket.RawData) {
      try {
        const msg = JSON.parse(String(raw)) as Record<string, unknown>;
        if (predicate(msg)) {
          cleanup();
          resolve(msg);
        }
      } catch {
        // ignore non-json
      }
    }

    function cleanup() {
      clearTimeout(timer);
      socket.off('message', onMessage);
    }

    socket.on('message', onMessage);
  });
}

describe('TZ critical flows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let rooms: CollabRoomsService;
  let port: number;
  const createdUserIds: string[] = [];
  const createdWorkspaceIds: string[] = [];

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.CLIENT_URL = process.env.CLIENT_URL ?? 'http://localhost:3000';
    process.env.PORT = process.env.PORT ?? '3001';
    process.env.REVALIDATE_SECRET =
      process.env.REVALIDATE_SECRET ?? 'change-me-revalidate';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    await app.listen(0);
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to bind test server');
    }
    port = address.port;
    prisma = app.get(PrismaService);
    rooms = app.get(CollabRoomsService);
  });

  afterAll(async () => {
    for (const workspaceId of createdWorkspaceIds) {
      await prisma.workspace.delete({ where: { id: workspaceId } }).catch(() => undefined);
    }
    for (const userId of createdUserIds) {
      await prisma.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await app.close();
  });

  async function register(
    label: string,
  ): Promise<{ tokens: Tokens; email: string; userId: string }> {
    const email = `e2e_${label}_${randomUUID().slice(0, 8)}@example.com`;
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email,
        password: 'password123',
        displayName: label.slice(0, 20) || 'User',
      })
      .expect(201);
    const tokens = res.body as Tokens;
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${tokens.accessToken}`)
      .expect(200);
    createdUserIds.push(me.body.id);
    return { tokens, email, userId: me.body.id as string };
  }

  async function createWorkspace(token: string, name: string) {
    const res = await request(app.getHttpServer())
      .post('/workspaces')
      .set('Authorization', `Bearer ${token}`)
      .send({ name })
      .expect(201);
    createdWorkspaceIds.push(res.body.id);
    return res.body as { id: string; name: string };
  }

  async function createDocument(
    token: string,
    workspaceId: string,
    title: string,
  ) {
    const res = await request(app.getHttpServer())
      .post(`/workspaces/${workspaceId}/documents`)
      .set('Authorization', `Bearer ${token}`)
      .send({ title })
      .expect(201);
    return res.body as { id: string; title: string; workspaceId: string };
  }

  it('workspace → document → Viewer invite: Viewer cannot edit via API (UI access=VIEW)', async () => {
    const owner = await register('owner');
    const viewer = await register('viewer');
    const workspace = await createWorkspace(
      owner.tokens.accessToken,
      `E2E WS ${randomUUID().slice(0, 6)}`,
    );
    const document = await createDocument(
      owner.tokens.accessToken,
      workspace.id,
      'Secret page',
    );

    const invite = await request(app.getHttpServer())
      .post(`/workspaces/${workspace.id}/invitations`)
      .set('Authorization', `Bearer ${owner.tokens.accessToken}`)
      .send({ email: viewer.email, role: 'VIEWER' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/workspaces/invitations/respond')
      .set('Authorization', `Bearer ${viewer.tokens.accessToken}`)
      .send({ invitationId: invite.body.id, action: 'accept' })
      .expect(201);

    const asViewer = await request(app.getHttpServer())
      .get(`/documents/${document.id}`)
      .set('Authorization', `Bearer ${viewer.tokens.accessToken}`)
      .expect(200);

    // Frontend uses access level to disable the editor (UI gate).
    expect(asViewer.body.access).toBe(AccessLevel.VIEW);

    await request(app.getHttpServer())
      .patch(`/documents/${document.id}`)
      .set('Authorization', `Bearer ${viewer.tokens.accessToken}`)
      .send({ title: 'Hacked' })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/documents/${document.id}/publish`)
      .set('Authorization', `Bearer ${viewer.tokens.accessToken}`)
      .send({ published: true })
      .expect(403);

    await request(app.getHttpServer())
      .post(`/documents/${document.id}/move`)
      .set('Authorization', `Bearer ${viewer.tokens.accessToken}`)
      .send({ parentId: null })
      .expect(403);

    // Owner still can edit.
    await request(app.getHttpServer())
      .patch(`/documents/${document.id}`)
      .set('Authorization', `Bearer ${owner.tokens.accessToken}`)
      .send({ title: 'Owner rename' })
      .expect(200);
  });

  it('two clients edit one document concurrently — both changes survive', async () => {
    const owner = await register('collab');
    const workspace = await createWorkspace(
      owner.tokens.accessToken,
      `E2E Collab ${randomUUID().slice(0, 6)}`,
    );
    const document = await createDocument(
      owner.tokens.accessToken,
      workspace.id,
      'Collab doc',
    );

    async function openClient(label: string) {
      const ydoc = new Y.Doc();
      const url = `ws://127.0.0.1:${port}/collab?documentId=${document.id}&token=${owner.tokens.accessToken}`;
      const socket = new WebSocket(url);
      await new Promise<void>((resolve, reject) => {
        socket.once('open', () => resolve());
        socket.once('error', reject);
      });
      const sync = await waitForMessage(socket, (msg) => msg.type === 'sync');
      Y.applyUpdate(ydoc, fromBase64(String(sync.update)), 'remote');

      ydoc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin === 'remote') return;
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(
            JSON.stringify({ type: 'update', update: toBase64(update) }),
          );
        }
      });

      socket.on('message', (raw) => {
        const msg = JSON.parse(String(raw)) as Record<string, unknown>;
        if (msg.type === 'update' || msg.type === 'sync') {
          Y.applyUpdate(ydoc, fromBase64(String(msg.update)), 'remote');
        }
      });

      return { label, socket, ydoc };
    }

    const a = await openClient('A');
    const b = await openClient('B');

    a.ydoc.getArray('blocks').push([
      (() => {
        const m = new Y.Map();
        m.set('id', 'block-a');
        m.set('type', 'paragraph');
        m.set('text', 'alpha');
        return m;
      })(),
    ]);
    b.ydoc.getArray('blocks').push([
      (() => {
        const m = new Y.Map();
        m.set('id', 'block-b');
        m.set('type', 'paragraph');
        m.set('text', 'bravo');
        return m;
      })(),
    ]);

    // Allow CRDT updates to cross the wire and persist path to run.
    await new Promise((r) => setTimeout(r, 500));
    await rooms.flushProjection(document.id);

    const idsA = (a.ydoc.getArray('blocks').toJSON() as Array<{ id: string }>).map(
      (row) => row.id,
    );
    const idsB = (b.ydoc.getArray('blocks').toJSON() as Array<{ id: string }>).map(
      (row) => row.id,
    );
    expect(idsA).toEqual(expect.arrayContaining(['block-a', 'block-b']));
    expect(idsB).toEqual(expect.arrayContaining(['block-a', 'block-b']));

    const projection = await prisma.documentProjection.findUniqueOrThrow({
      where: { documentId: document.id },
    });
    const blocks = projection.blocksJson as Array<{ id: string; text: string }>;
    const blockIds = blocks.map((b) => b.id);
    expect(blockIds).toEqual(expect.arrayContaining(['block-a', 'block-b']));
    expect(blocks.find((b) => b.id === 'block-a')?.text).toBe('alpha');
    expect(blocks.find((b) => b.id === 'block-b')?.text).toBe('bravo');

    a.socket.close();
    b.socket.close();
    a.ydoc.destroy();
    b.ydoc.destroy();
  });

  it('publish → public payload reflects live edits (SSR/ISR source) + revalidate job', async () => {
    const revalidateHits: Array<Record<string, unknown>> = [];
    const mockServer = createServer((req, res) => {
      if (req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          revalidateHits.push(JSON.parse(body || '{}') as Record<string, unknown>);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ revalidated: true }));
        });
        return;
      }
      res.writeHead(404);
      res.end();
    });
    await new Promise<void>((resolve) => mockServer.listen(0, '127.0.0.1', resolve));
    const mockAddress = mockServer.address();
    if (!mockAddress || typeof mockAddress === 'string') {
      throw new Error('mock revalidate server failed');
    }
    process.env.NEXT_REVALIDATE_URL = `http://127.0.0.1:${mockAddress.port}/api/revalidate`;
    process.env.REVALIDATE_SECRET = 'e2e-revalidate-secret';

    const owner = await register('publish');
    const workspace = await createWorkspace(
      owner.tokens.accessToken,
      `E2E Pub ${randomUUID().slice(0, 6)}`,
    );
    const document = await createDocument(
      owner.tokens.accessToken,
      workspace.id,
      'Draft',
    );

    // Seed live content via room projection before publish.
    const room = await rooms.getRoom(document.id);
    room.ydoc.getMap('meta').set('title', 'Published Live Title');
    const blocks = room.ydoc.getArray('blocks');
    if (blocks.length === 0) {
      const m = new Y.Map();
      m.set('id', 'p1');
      m.set('type', 'paragraph');
      m.set('text', 'fresh body');
      blocks.push([m]);
    } else {
      const first = blocks.get(0);
      if (first instanceof Y.Map) {
        first.set('text', 'fresh body');
      }
    }

    const published = await request(app.getHttpServer())
      .post(`/documents/${document.id}/publish`)
      .set('Authorization', `Bearer ${owner.tokens.accessToken}`)
      .send({ published: true })
      .expect(201);

    expect(published.body.publicationStatus).toBe('PUBLISHED');
    expect(published.body.publicSlug).toBeTruthy();

    const publicPage = await request(app.getHttpServer())
      .get(`/public/documents/${published.body.publicSlug}`)
      .expect(200);

    expect(publicPage.body.title).toBe('Published Live Title');
    expect(JSON.stringify(publicPage.body.blocks)).toContain('fresh body');

    // Edit again and republish/flush — public payload must update (ISR source of truth).
    room.ydoc.getMap('meta').set('title', 'After Edit');
    await rooms.flushProjection(document.id);

    const after = await request(app.getHttpServer())
      .get(`/public/documents/${published.body.publicSlug}`)
      .expect(200);
    expect(after.body.title).toBe('After Edit');

    // Drain outbox → BullMQ revalidate processor (may take a couple seconds).
    await new Promise((r) => setTimeout(r, 4500));
    expect(
      revalidateHits.some(
        (hit) => hit.slug === published.body.publicSlug || !!hit.tag,
      ),
    ).toBe(true);

    mockServer.close();
    rooms.closeDeleted(document.id);
  });
});
