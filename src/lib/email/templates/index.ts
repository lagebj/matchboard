import type { NotificationTemplate } from "@/generated/prisma/client";

export type TemplateKey = NotificationTemplate;

export interface TemplateData {
  subject: string;
  htmlBody: string;
  textBody: string;
}

export interface TemplatePayload {
  template: TemplateKey;
  data: Record<string, unknown>;
}

export type TemplateRenderer = (
  data: Record<string, unknown>,
) => TemplateData;

const templateRegistry = new Map<TemplateKey, TemplateRenderer>();

export function registerTemplate(
  key: TemplateKey,
  renderer: TemplateRenderer,
): void {
  templateRegistry.set(key, renderer);
}

export function renderTemplate(
  key: TemplateKey,
  data: Record<string, unknown>,
): TemplateData {
  const renderer = templateRegistry.get(key);
  if (!renderer) {
    throw new Error(`Unknown email template: ${key}`);
  }
  return renderer(data);
}

export function getRegisteredTemplates(): TemplateKey[] {
  return [...templateRegistry.keys()];
}