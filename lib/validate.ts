import { BUG_TYPES, SEVERITIES, STATUSES } from "@/db/schema";

export class ValidationError extends Error {}

export function requiredString(
  value: unknown,
  field: string,
  { max = 10_000, min = 1 }: { max?: number; min?: number } = {},
): string {
  if (typeof value !== "string" || value.trim().length < min) {
    throw new ValidationError(`"${field}" is required.`);
  }
  const trimmed = value.trim();
  if (trimmed.length > max) {
    throw new ValidationError(`"${field}" must be at most ${max} characters.`);
  }
  return trimmed;
}

export function optionalString(
  value: unknown,
  field: string,
  { max = 10_000 }: { max?: number } = {},
): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") throw new ValidationError(`"${field}" must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > max) {
    throw new ValidationError(`"${field}" must be at most ${max} characters.`);
  }
  return trimmed;
}

export function oneOf<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  field: string,
): T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new ValidationError(`"${field}" must be one of: ${allowed.join(", ")}.`);
  }
  return value as T[number];
}

export const bugType = (v: unknown) => oneOf(v, BUG_TYPES, "bug_type");
export const severity = (v: unknown) => oneOf(v, SEVERITIES, "severity");
export const status = (v: unknown) => oneOf(v, STATUSES, "status");

export const MAX_IMAGES = 10;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB each

export type ParsedImage = { data: Buffer; mimetype: string; filename: string };

export function parseImages(value: unknown): ParsedImage[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ValidationError(`"images" must be an array.`);
  if (value.length > MAX_IMAGES) {
    throw new ValidationError(`At most ${MAX_IMAGES} attachments per bug.`);
  }
  return value.map((raw, i) => {
    if (typeof raw !== "object" || raw === null) {
      throw new ValidationError(`images[${i}] must be an object.`);
    }
    const item = raw as Record<string, unknown>;
    const base64 = requiredString(item.data, `images[${i}].data`, { max: 20_000_000 });
    const mimetype = requiredString(item.mimetype, `images[${i}].mimetype`, { max: 128 });
    const filename = requiredString(item.filename, `images[${i}].filename`, { max: 255 });
    const cleaned = base64.includes(",") && base64.startsWith("data:")
      ? base64.slice(base64.indexOf(",") + 1)
      : base64;
    if (!/^[A-Za-z0-9+/=\s]+$/.test(cleaned)) {
      throw new ValidationError(`images[${i}].data must be base64.`);
    }
    const data = Buffer.from(cleaned, "base64");
    if (data.length === 0) throw new ValidationError(`images[${i}].data is empty.`);
    if (data.length > MAX_IMAGE_BYTES) {
      throw new ValidationError(`images[${i}] is larger than 10 MB.`);
    }
    if (!/^[\w.+-]+\/[\w.+-]+$/.test(mimetype)) {
      throw new ValidationError(`images[${i}].mimetype is not a valid MIME type.`);
    }
    return { data, mimetype, filename: filename.replace(/[/\\]/g, "_") };
  });
}
