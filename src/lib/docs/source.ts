import { defineDocs } from "fumadocs-mdx/macro";
import { loader } from "fumadocs-core/source";

/**
 * Canonical documentation content source (ADR-0103). Both the public /docs/**
 * site and the authenticated in-app Help drawer render pages resolved from
 * this one loader -- never a second copy of documentation prose.
 */
const docs = defineDocs({
  dir: "content/docs",
});

export const source = loader({
  baseUrl: "/docs",
  source: docs.toFumadocsSource(),
});
