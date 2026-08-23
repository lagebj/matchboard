type MatchboardEnv = "development" | "test" | "staging" | "production";

const VALID_ENVS: Set<string> = new Set(["development", "test", "staging", "production"]);

export { VALID_ENVS };

function resolveMatchboardEnv(): MatchboardEnv {
  const env = process.env.MATCHBOARD_ENV;
  if (env && VALID_ENVS.has(env)) {
    return env as MatchboardEnv;
  }
  if (env) {
    throw new Error(
      `Invalid MATCHBOARD_ENV: "${env}". Must be one of: development, test, staging, production.`,
    );
  }
  // Fallback: infer from NODE_ENV
  const nodeEnv = process.env.NODE_ENV ?? "development";
  switch (nodeEnv) {
    case "production":
      return "production";
    case "test":
      return "test";
    default:
      return "development";
  }
}

export const matchboardEnv: MatchboardEnv = resolveMatchboardEnv();

export function isProduction(): boolean {
  return matchboardEnv === "production";
}

export function isTest(): boolean {
  return matchboardEnv === "test";
}

export function isDevelopment(): boolean {
  return matchboardEnv === "development";
}

export function isStaging(): boolean {
  return matchboardEnv === "staging";
}

export interface RequiredEnvVar {
  name: string;
  requiredIn: MatchboardEnv[];
  validate?: (value: string) => string | undefined;
}

// Canonical vars that every real app-server environment needs, independent of dev/test/staging/
// production — each environment supplies its own values, the app code doesn't branch on which.
// TEST_DATABASE_URL is deliberately NOT here: it's a local/CI vitest-suite-only convention
// (enforced independently by vitest.config.ts and src/test/test-db.ts), not something the
// deployed Test application server needs — it connects to its database via DATABASE_URL/
// DIRECT_URL exactly like every other environment.
const REQUIRED_ENV_VARS: RequiredEnvVar[] = [
  {
    name: "DATABASE_URL",
    requiredIn: ["development", "test", "staging", "production"],
    validate: (v) => (v.startsWith("postgresql://") || v.startsWith("postgres://") ? undefined : "Must be a PostgreSQL connection string"),
  },
  {
    name: "DIRECT_URL",
    requiredIn: ["development", "test", "staging", "production"],
    validate: (v) => (v.startsWith("postgresql://") || v.startsWith("postgres://") ? undefined : "Must be a PostgreSQL connection string"),
  },
  {
    name: "AUTH_SECRET",
    requiredIn: ["development", "test", "staging", "production"],
  },
  {
    name: "AUTH_GOOGLE_ID",
    requiredIn: ["development", "test", "staging", "production"],
  },
  {
    name: "AUTH_GOOGLE_SECRET",
    requiredIn: ["development", "test", "staging", "production"],
  },
];

export interface EnvValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateEnv(): EnvValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const varSpec of REQUIRED_ENV_VARS) {
    if (!varSpec.requiredIn.includes(matchboardEnv)) {
      continue;
    }
    const value = process.env[varSpec.name];
    if (!value || value === `replace-with-your-${varSpec.name.toLowerCase()}`) {
      errors.push(`${varSpec.name} is required in ${matchboardEnv} environment but is not set.`);
      continue;
    }
    if (varSpec.validate) {
      const validationError = varSpec.validate(value);
      if (validationError) {
        errors.push(`${varSpec.name}: ${validationError}`);
      }
    }
  }

  // Warn about NEXT_PUBLIC_ prefixed secrets
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("NEXT_PUBLIC_") && value) {
      if (key.includes("SECRET") || key.includes("DATABASE") || key.includes("AUTH_")) {
        errors.push(`${key} must not be prefixed with NEXT_PUBLIC_ — it would be exposed to the browser.`);
      }
    }
  }

  // Production-specific checks (uses process.env directly for testability)
  const isProdEnv = process.env.MATCHBOARD_ENV === "production" ||
    (!process.env.MATCHBOARD_ENV && process.env.NODE_ENV === "production");

  if (isProdEnv) {
    if (!process.env.APP_BASE_URL) {
      errors.push("APP_BASE_URL is required in production for secure link generation. External URLs must originate from a validated base URL, not from Host headers or localhost fallbacks.");
    } else {
      const url = process.env.APP_BASE_URL;
      if (!url.startsWith("https://")) {
        errors.push(`APP_BASE_URL must start with https:// in production. Got: ${url}`);
      }
    }
    if (!process.env.BREVO_API_KEY) {
      warnings.push("BREVO_API_KEY should be set in production for transactional email delivery.");
    }
    if (process.env.BYPASS_AUTH === "true") {
      errors.push("BYPASS_AUTH=true must not be set in production. Test-only authentication mechanisms cannot be active in a production environment.");
    }
    if (process.env.TEST_AGENT_AUTH_ENABLED === "true") {
      errors.push("TEST_AGENT_AUTH_ENABLED=true must not be set in production. Test-only authentication mechanisms cannot be active in a production environment.");
    }
    if (process.env.TEST_AGENT_AUTH_SECRET) {
      errors.push("TEST_AGENT_AUTH_SECRET must not be set in production. Test-only authentication secrets cannot be active in a production environment.");
    }
    if (!process.env.CRON_SECRET) {
      errors.push("CRON_SECRET is required in production to protect cron endpoints from unauthenticated access.");
    }
    if (!process.env.BREVO_WEBHOOK_BEARER_TOKEN) {
      errors.push("BREVO_WEBHOOK_BEARER_TOKEN is required in production to authenticate webhook delivery from Brevo.");
    }
  }

  // Non-production APP_BASE_URL warnings
  if (!isProdEnv && !isTest() && !process.env.APP_BASE_URL) {
    warnings.push("APP_BASE_URL is not set. External URLs will fall back to localhost, which may be incorrect for staging deployments.");
  }

  return { valid: errors.length === 0, errors, warnings };
}

// Public routes that do not require authentication.
// These routes are accessible without a session.
// All other routes require an authenticated session with an email.
export const PUBLIC_ROUTES = [
  "/api/auth",
  "/_next",
  "/favicon.ico",
  "/robots.txt",
  "/signin",
  "/error",
  "/api/health",
  "/api/meta",
  "/api/locale",
] as const;

export type PublicRoute = (typeof PUBLIC_ROUTES)[number];

export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route.endsWith("/")) {
      return pathname.startsWith(route) || pathname === route.slice(0, -1);
    }
    return pathname.startsWith(route);
  });
}

let envValidated = false;
let envValidationResult: EnvValidationResult | null = null;

export function ensureEnvValidated(): EnvValidationResult {
  if (envValidated) return envValidationResult!;
  envValidated = true;
  envValidationResult = validateEnv();
  if (!envValidationResult.valid) {
    for (const error of envValidationResult.errors) {
      console.error(`[env] ${error}`);
    }
  }
  for (const warning of envValidationResult.warnings) {
    console.warn(`[env] ${warning}`);
  }
  return envValidationResult;
}

export function requireEnvValid(): void {
  const result = ensureEnvValidated();
  if (!result.valid) {
    throw new Error(`Environment validation failed: ${result.errors.join("; ")}`);
  }
}

export function _resetEnvValidation(): void {
  envValidated = false;
  envValidationResult = null;
}

export function isTestAgentAuthEnabled(): boolean {
  const env = process.env.MATCHBOARD_ENV ?? (process.env.NODE_ENV ?? "development");
  return env === "test" && process.env.TEST_AGENT_AUTH_ENABLED === "true" && !!process.env.TEST_AGENT_AUTH_SECRET;
}

export function getTestAgentAuthSecret(): string | undefined {
  return process.env.TEST_AGENT_AUTH_SECRET || undefined;
}

export const TEST_AGENT_AUTH_NAMESPACE = "test-agent.matchboard.football";

export function getAppBaseUrl(): string {
  if (process.env.APP_BASE_URL) {
    return process.env.APP_BASE_URL;
  }
  if (isDevelopment() || isTest()) {
    return "http://localhost:3000";
  }
  return "";
}

export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET || undefined;
}

export function getBrevoWebhookBearerToken(): string {
  return process.env.BREVO_WEBHOOK_BEARER_TOKEN ?? "";
}

export function getEmailFromAddress(): string {
  return process.env.EMAIL_FROM_ADDRESS ?? "notifications@matchboard.football";
}

export function getEmailFromName(): string {
  return process.env.EMAIL_FROM_NAME ?? "Matchboard";
}

export function getBrevoApiKey(): string | undefined {
  return process.env.BREVO_API_KEY || undefined;
}

export function getBrevoTestRecipients(): Set<string> {
  const raw = process.env.BREVO_TEST_RECIPIENTS ?? "";
  return new Set(raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean));
}

export function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET environment variable is not set.");
  }
  return secret;
}

/** Dedicated signing secret for live-match realtime connection tickets — never reuse
 * AUTH_SECRET (live-match-realtime-programme SPEC.md §11). */
export function getLiveMatchRealtimeSecret(): string {
  const secret = process.env.LIVE_MATCH_REALTIME_SECRET;
  if (!secret) {
    throw new Error("LIVE_MATCH_REALTIME_SECRET environment variable is not set.");
  }
  return secret;
}

/** Dedicated HMAC signing secret for Worker->Vercel internal live-match persistence requests
 * (SPEC.md §18) — never reuse AUTH_SECRET or LIVE_MATCH_REALTIME_SECRET. The same value must
 * also be set as the Worker's own secret via the deploy workflow's secret-sync step. */
export function getLiveMatchInternalSecret(): string {
  const secret = process.env.LIVE_MATCH_INTERNAL_SECRET;
  if (!secret) {
    throw new Error("LIVE_MATCH_INTERNAL_SECRET environment variable is not set.");
  }
  return secret;
}

export function isCspEnforceEnabled(): boolean {
  return process.env.CSP_ENFORCE === "true";
}

export function isRlsDebug(): boolean {
  return process.env.RLS_DEBUG === "1";
}

export function getPreviewAllowlistEmails(): string {
  return process.env.PREVIEW_ALLOWLIST_EMAILS ?? "";
}

export function isVercelPreview(): boolean {
  return process.env.VERCEL_ENV === "preview";
}