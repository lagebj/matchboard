export async function register() {
  const { ensureEnvValidated } = await import("./src/lib/env");
  ensureEnvValidated();
}