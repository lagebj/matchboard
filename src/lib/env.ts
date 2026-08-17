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

const REQUIRED_ENV_VARS: RequiredEnvVar[] = [
  {
    name: "DATABASE_URL",
    requiredIn: ["development", "staging", "production"],
    validate: (v) => (v.startsWith("postgresql://") || v.startsWith("postgres://") ? undefined : "Must be a PostgreSQL connection string"),
  },
  {
    name: "DIRECT_URL",
    requiredIn: ["development", "staging", "production"],
    validate: (v) => (v.startsWith("postgresql://") || v.startsWith("postgres://") ? undefined : "Must be a PostgreSQL connection string"),
  },
  {
    name: "AUTH_SECRET",
    requiredIn: ["development", "staging", "production"],
  },
  {
    name: "AUTH_GOOGLE_ID",
    requiredIn: ["development", "staging", "production"],
  },
  {
    name: "AUTH_GOOGLE_SECRET",
    requiredIn: ["development", "staging", "production"],
  },
  {
    name: "TEST_DATABASE_URL",
    requiredIn: ["test"],
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

  // Production-specific warnings
  if (isProduction()) {
    if (!process.env.APP_BASE_URL) {
      warnings.push("APP_BASE_URL should be set in production for email link generation.");
    }
    if (!process.env.BREVO_API_KEY) {
      warnings.push("BREVO_API_KEY should be set in production for transactional email delivery.");
    }
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