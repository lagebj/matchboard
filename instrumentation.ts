export async function register() {
  const { ensureEnvValidated } = await import("./src/lib/env");
  const result = ensureEnvValidated();
  if (!result.valid) {
    console.error(
      `[instrumentation] Environment validation failed with ${result.errors.length} error(s). ` +
        "Routes requiring missing variables will fail. See logs above for details.",
    );
  }
}