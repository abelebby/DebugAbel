/**
 * Postgres unique-constraint violation (SQLSTATE 23505).
 *
 * drizzle-orm wraps driver errors in its own Error, so the SQLSTATE is NOT on
 * the object it throws - `error.code` is undefined and the real pg error hangs
 * off `error.cause`. The chain has to be walked, or every unique violation is
 * misreported as a 500 instead of a 409.
 */
export function isUniqueViolation(error: unknown): boolean {
  return hasCode(error, "23505");
}

/** Postgres foreign-key violation (SQLSTATE 23503). */
export function isForeignKeyViolation(error: unknown): boolean {
  return hasCode(error, "23503");
}

function hasCode(error: unknown, code: string): boolean {
  let current = error;
  const seen = new Set<unknown>();

  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    if ((current as { code?: unknown }).code === code) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** The constraint name Postgres reported, if any (e.g. "projects_name_unique"). */
export function constraintName(error: unknown): string | undefined {
  let current = error;
  const seen = new Set<unknown>();

  while (typeof current === "object" && current !== null && !seen.has(current)) {
    seen.add(current);
    const name = (current as { constraint?: unknown }).constraint;
    if (typeof name === "string") return name;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}
