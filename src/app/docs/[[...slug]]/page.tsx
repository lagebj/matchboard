import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsPage, DocsBody, DocsTitle, DocsDescription } from "fumadocs-ui/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { source } from "@/lib/docs/source";
import { EmbedLink } from "./embed-link";

/**
 * `/docs/embed/**` is a compact rendering mode of this exact same page for the in-app Help
 * drawer's <iframe> (see [[...slug]]/layout.tsx) -- strip the leading "embed" segment before
 * resolving content so both routes hit the identical canonical `content/docs/**` page.
 */
function resolveSlug(rawSlug: string[] | undefined): { slug: string[] | undefined; isEmbed: boolean } {
  if (rawSlug?.[0] === "embed") return { slug: rawSlug.slice(1), isEmbed: true };
  return { slug: rawSlug, isEmbed: false };
}

export default async function DocsContentPage({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug: rawSlug } = await params;
  const { slug, isEmbed } = resolveSlug(rawSlug);
  const page = source.getPage(slug);
  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <DocsPage
      toc={page.data.toc}
      full={page.data.full}
      {...(isEmbed
        ? {
            tableOfContent: { enabled: false },
            tableOfContentPopover: { enabled: false },
            breadcrumb: { enabled: false },
            footer: { enabled: false },
          }
        : {})}
    >
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDX components={isEmbed ? { ...defaultMdxComponents, a: EmbedLink } : defaultMdxComponents} />
      </DocsBody>
    </DocsPage>
  );
}

export function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}): Promise<Metadata> {
  const { slug: rawSlug } = await params;
  const { slug } = resolveSlug(rawSlug);
  const page = source.getPage(slug);
  if (!page) notFound();

  return {
    title: `${page.data.title} | Matchboard Docs`,
    description: page.data.description,
  };
}
