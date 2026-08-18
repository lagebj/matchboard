import { isDevelopment, isCspEnforceEnabled } from "@/lib/env";

export function isCspReportOnly(): boolean {
  return !isCspEnforceEnabled();
}

export function getContentSecurityPolicy(): { header: string; value: string } {
  const isDev = isDevelopment();
  const reportOnly = isCspReportOnly();

  const directives = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline' 'unsafe-eval'${isDev ? " https://vaadin.github.io" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://accounts.google.com",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
    "upgrade-insecure-requests",
  ];

  if (reportOnly) {
    directives.push("report-uri /api/csp-report");
  }

  const value = directives.join("; ");

  return {
    header: reportOnly
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy",
    value,
  };
}