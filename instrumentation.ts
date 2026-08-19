/**
 * Runs once when the server boots (Next.js instrumentation hook).
 *
 * SECURITY: required secrets are validated here so the process refuses to
 * start when something is missing, instead of falling back to a default or
 * failing later on a random request.
 */
export async function register() {
  const { databaseUrl, authPassword, sessionSecret, agentToken } = await import("./lib/env");
  databaseUrl();
  authPassword();
  sessionSecret();
  agentToken();
  console.log("Bug Tracker: environment OK.");
}
