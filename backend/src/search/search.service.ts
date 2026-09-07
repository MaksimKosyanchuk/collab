import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MeiliSearch } from 'meilisearch';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';

const INDEX = 'documents';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly client: MeiliSearch;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly access: AccessService,
  ) {
    this.client = new MeiliSearch({
      host: this.config.get('MEILI_HOST', 'http://localhost:7700'),
      apiKey: this.config.get('MEILI_API_KEY'),
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      const index = this.client.index(INDEX);
      await index.updateFilterableAttributes(['workspaceId', 'documentId']);
      await index.updateSearchableAttributes(['title', 'plainText']);
    } catch {
      // Meilisearch may be down during unit tests / first boot
    }
  }

  async indexDocument(documentId: string): Promise<void> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      include: { projection: true },
    });
    if (!document || document.deletedAt) {
      await this.client.index(INDEX).deleteDocument(documentId).catch(() => undefined);
      return;
    }
    await this.client.index(INDEX).addDocuments([
      {
        id: document.id,
        documentId: document.id,
        workspaceId: document.workspaceId,
        title: document.projection?.title ?? document.title,
        plainText: document.projection?.plainText ?? '',
      },
    ]);
  }

  async search(workspaceId: string, userId: string, query: string) {
    await this.access.assertWorkspaceMember(workspaceId, userId);
    let hits: Array<{ id: string; title: string; plainText: string }> = [];
    try {
      const result = await this.client.index(INDEX).search(query, {
        filter: `workspaceId = "${workspaceId}"`,
        limit: 20,
      });
      hits = result.hits as typeof hits;
    } catch {
      const rows = await this.prisma.document.findMany({
        where: {
          workspaceId,
          deletedAt: null,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { projection: { plainText: { contains: query, mode: 'insensitive' } } },
          ],
        },
        take: 20,
        include: { projection: true },
      });
      hits = rows.map((row) => ({
        id: row.id,
        title: row.title,
        plainText: row.projection?.plainText ?? '',
      }));
    }

    const visible = [];
    for (const hit of hits) {
      try {
        await this.access.assertDocumentView(hit.id, { userId });
        visible.push(hit);
      } catch {
        // drop hits the user cannot see
      }
    }
    return visible;
  }
}
