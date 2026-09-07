import type { Metadata } from 'next';
import { apiBase } from '@/lib/api';
import type { PublishedDocument } from '@/lib/types';

type Props = {
  params: Promise<{ slug: string }>;
};

async function loadPublished(slug: string): Promise<PublishedDocument | null> {
  const res = await fetch(`${apiBase()}/public/documents/${slug}`, {
    next: { revalidate: 30, tags: [`public-doc:${slug}`] },
  });
  if (!res.ok) {
    return null;
  }
  return res.json() as Promise<PublishedDocument>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const doc = await loadPublished(slug);
  if (!doc) {
    return { title: 'Not found · Collab Docs' };
  }
  return {
    title: `${doc.title} · Collab Docs`,
    description: doc.description || undefined,
  };
}

export default async function PublicDocumentPage({ params }: Props) {
  const { slug } = await params;
  const doc = await loadPublished(slug);

  if (!doc) {
    return (
      <main className="mx-auto max-w-3xl px-5 py-16">
        <p className="brand text-3xl">Collab Docs</p>
        <h1 className="mt-6 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-muted">
          This public link is missing, unpublished, or expired.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-5 py-16">
      <p className="brand text-2xl">Collab Docs</p>
      <article className="panel mt-8 rounded-[1.5rem] p-8 md:p-10">
        <h1 className="text-4xl font-semibold tracking-tight">{doc.title}</h1>
        {doc.description ? (
          <p className="mt-3 text-lg text-muted">{doc.description}</p>
        ) : null}
        <div className="mt-8 space-y-4">
          {doc.blocks.length === 0 ? (
            <p className="empty">This page has no content yet.</p>
          ) : (
            doc.blocks.map((block) => {
              if (block.type === 'heading') {
                return (
                  <h2 key={block.id} className="text-2xl font-semibold">
                    {block.text}
                  </h2>
                );
              }
              if (block.type === 'code') {
                return (
                  <pre
                    key={block.id}
                    className="overflow-x-auto rounded-xl bg-ink px-4 py-3 text-sm text-accent-ink"
                  >
                    <code>{block.text}</code>
                  </pre>
                );
              }
              if (block.type === 'checkbox') {
                return (
                  <p key={block.id} className="flex gap-2">
                    <span>{block.checked ? '☑' : '☐'}</span>
                    <span>{block.text}</span>
                  </p>
                );
              }
              if (block.type === 'list' && block.items?.length) {
                return (
                  <ul key={block.id} className="list-disc space-y-1 pl-5">
                    {block.items.map((item, index) => (
                      <li key={`${block.id}-${index}`}>{item}</li>
                    ))}
                  </ul>
                );
              }
              if (block.type === 'image' && block.src) {
                return (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={block.id}
                    src={block.src}
                    alt={block.text || ''}
                    className="max-h-[28rem] rounded-xl"
                  />
                );
              }
              return (
                <p key={block.id} className="leading-7">
                  {block.text}
                </p>
              );
            })
          )}
        </div>
      </article>
    </main>
  );
}
