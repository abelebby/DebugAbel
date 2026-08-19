/**
 * Required environment configuration.
 *
 * SECURITY: there are deliberately NO fallback/default values for secrets.
 * If something required is missing the app throws on first use instead of
 * silently running with a hardcoded value.
 */

function required(name: string, minLength = 1): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  if (value.length < minLength) {
    throw new Error(`Environment variable ${name} must be at least ${minLength} characters long.`);
  }
  return value;
}

export function databaseUrl(): string {
  return required("DATABASE_URL");
}

export function authPassword(): string {
  return required("AUTH_PASSWORD", 8);
}

export function sessionSecret(): string {
  return required("SESSION_SECRET", 32);
}

/**
 * Shared secret the MCP agent (log_bug/list_bugs/get_bug) must present on
 * every call. Now that the app is hosted on the public internet instead of
 * bound to 127.0.0.1, network position no longer proves anything - this
 * token is the *only* boundary protecting the four agent-reachable routes
 * (see lib/local-only.ts and lib/auth.ts), so unlike the other env vars it
 * used to be genuinely optional, it is now required, with no fallback.
 */
export function agentToken(): string {
  return required("AGENT_TOKEN", 24);
}
