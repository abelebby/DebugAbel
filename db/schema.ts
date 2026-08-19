import {
  pgTable,
  pgEnum,
  text,
  serial,
  timestamp,
  customType,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { randomUUID } from "crypto";

/** Postgres bytea column, exposed to app code as a Node Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export const BUG_TYPES = ["Functional", "Security", "Aesthetic"] as const;
export const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
export const STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;
export const SOURCES = ["web", "agent"] as const;

export const bugTypeEnum = pgEnum("bug_type", BUG_TYPES);
export const severityEnum = pgEnum("severity", SEVERITIES);
export const bugStatusEnum = pgEnum("bug_status", STATUSES);
export const bugSourceEnum = pgEnum("bug_source", SOURCES);

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());

export const projects = pgTable("projects", {
  id: id(),
  name: text("name").notNull().unique(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const features = pgTable(
  "features",
  {
    id: id(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("features_project_name_idx").on(t.projectId, t.name)],
);

export const bugs = pgTable(
  "bugs",
  {
    id: id(),
    // Globally sequential, shown to users as "Bug #48".
    number: serial("number").notNull().unique(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    featureId: text("feature_id")
      .notNull()
      .references(() => features.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description").notNull(),
    stepsToReproduce: text("steps_to_reproduce").notNull(),
    bugType: bugTypeEnum("bug_type").notNull(),
    severity: severityEnum("severity").notNull(),
    status: bugStatusEnum("status").notNull().default("Open"),
    reporter: text("reporter").notNull(),
    environment: text("environment"),
    source: bugSourceEnum("source").notNull().default("web"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("bugs_project_idx").on(t.projectId), index("bugs_feature_idx").on(t.featureId)],
);

export const attachments = pgTable(
  "attachments",
  {
    id: id(),
    bugId: text("bug_id")
      .notNull()
      .references(() => bugs.id, { onDelete: "cascade" }),
    data: bytea("data").notNull(),
    mimetype: text("mimetype").notNull(),
    filename: text("filename").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("attachments_bug_idx").on(t.bugId)],
);

export const comments = pgTable(
  "comments",
  {
    id: id(),
    bugId: text("bug_id")
      .notNull()
      .references(() => bugs.id, { onDelete: "cascade" }),
    author: text("author").notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("comments_bug_idx").on(t.bugId)],
);

export const projectRelations = relations(projects, ({ many }) => ({
  features: many(features),
  bugs: many(bugs),
}));

export const featureRelations = relations(features, ({ one, many }) => ({
  project: one(projects, { fields: [features.projectId], references: [projects.id] }),
  bugs: many(bugs),
}));

export const bugRelations = relations(bugs, ({ one, many }) => ({
  project: one(projects, { fields: [bugs.projectId], references: [projects.id] }),
  feature: one(features, { fields: [bugs.featureId], references: [features.id] }),
  attachments: many(attachments),
  comments: many(comments),
}));

export const attachmentRelations = relations(attachments, ({ one }) => ({
  bug: one(bugs, { fields: [attachments.bugId], references: [bugs.id] }),
}));

export const commentRelations = relations(comments, ({ one }) => ({
  bug: one(bugs, { fields: [comments.bugId], references: [bugs.id] }),
}));

export type BugType = (typeof BUG_TYPES)[number];
export type Severity = (typeof SEVERITIES)[number];
export type BugStatus = (typeof STATUSES)[number];
export type BugSource = (typeof SOURCES)[number];
