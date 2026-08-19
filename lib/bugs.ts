import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { bugs, features, projects, attachments, comments } from "@/db/schema";
import { ValidationError, requiredString } from "@/lib/validate";

/**
 * All database access below goes through Drizzle's query builder, which always
 * emits parameterized SQL. No query in this project is built by string
 * concatenation or template interpolation.
 */

export type BugFilters = {
  projectId?: string;
  featureId?: string;
  bugType?: string;
  severity?: string;
  status?: string;
};

export async function listBugs(filters: BugFilters) {
  const conditions = [
    filters.projectId ? eq(bugs.projectId, filters.projectId) : undefined,
    filters.featureId ? eq(bugs.featureId, filters.featureId) : undefined,
    filters.bugType ? eq(bugs.bugType, filters.bugType as never) : undefined,
    filters.severity ? eq(bugs.severity, filters.severity as never) : undefined,
    filters.status ? eq(bugs.status, filters.status as never) : undefined,
  ].filter(Boolean);

  const rows = await db.query.bugs.findMany({
    where: conditions.length ? and(...(conditions as never[])) : undefined,
    orderBy: [desc(bugs.number)],
    with: {
      project: { columns: { id: true, name: true } },
      feature: { columns: { id: true, name: true } },
      // Never select attachments.data here - metadata only.
      attachments: { columns: { id: true, filename: true, mimetype: true } },
      comments: { orderBy: [comments.createdAt] },
    },
  });
  return rows;
}

export async function getBug(id: string) {
  return db.query.bugs.findFirst({
    where: eq(bugs.id, id),
    with: {
      project: { columns: { id: true, name: true } },
      feature: { columns: { id: true, name: true } },
      attachments: { columns: { id: true, filename: true, mimetype: true } },
      comments: { orderBy: [comments.createdAt] },
    },
  });
}

/**
 * Resolves the project/feature a bug belongs to. Accepts either ids (the web
 * form sends these) or names (the MCP agent sends these, since a tester talks
 * about "the Login screen", not a cuid). Unknown names are created.
 */
export async function resolveProjectAndFeature(body: Record<string, unknown>) {
  let project: { id: string } | undefined;

  if (typeof body.project_id === "string" && body.project_id) {
    project = await db.query.projects.findFirst({
      where: eq(projects.id, body.project_id),
      columns: { id: true },
    });
    if (!project) throw new ValidationError("Unknown project_id.");
  } else {
    const name = requiredString(body.project, "project", { max: 120 });
    project = await db.query.projects.findFirst({
      where: eq(projects.name, name),
      columns: { id: true },
    });
    if (!project) {
      [project] = await db.insert(projects).values({ name }).returning({ id: projects.id });
    }
  }

  let feature: { id: string } | undefined;
  if (typeof body.feature_id === "string" && body.feature_id) {
    feature = await db.query.features.findFirst({
      where: and(eq(features.id, body.feature_id), eq(features.projectId, project.id)),
      columns: { id: true },
    });
    if (!feature) throw new ValidationError("Unknown feature_id for this project.");
  } else {
    const name = requiredString(body.feature, "feature", { max: 120 });
    feature = await db.query.features.findFirst({
      where: and(eq(features.projectId, project.id), eq(features.name, name)),
      columns: { id: true },
    });
    if (!feature) {
      [feature] = await db
        .insert(features)
        .values({ projectId: project.id, name })
        .returning({ id: features.id });
    }
  }

  return { projectId: project.id, featureId: feature.id };
}

export async function insertAttachments(
  bugId: string,
  images: { data: Buffer; mimetype: string; filename: string }[],
) {
  if (images.length === 0) return;
  await db.insert(attachments).values(images.map((image) => ({ ...image, bugId })));
}
