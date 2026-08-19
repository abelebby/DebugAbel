export type Comment = {
  id: string;
  bugId: string;
  author: string;
  body: string;
  createdAt: string;
};

export type AttachmentMeta = { id: string; filename: string; mimetype: string };

export type Bug = {
  id: string;
  number: number;
  projectId: string;
  featureId: string;
  title: string;
  description: string;
  stepsToReproduce: string;
  bugType: "Functional" | "Security" | "Aesthetic";
  severity: "Critical" | "High" | "Medium" | "Low";
  status: "Open" | "In Progress" | "Resolved" | "Closed";
  reporter: string;
  environment: string | null;
  source: "web" | "agent";
  createdAt: string;
  updatedAt: string;
  project: { id: string; name: string };
  feature: { id: string; name: string };
  attachments: AttachmentMeta[];
  comments: Comment[];
};

export type Feature = { id: string; projectId: string; name: string };
export type Project = { id: string; name: string; description: string; features: Feature[] };

export const BUG_TYPES = ["Functional", "Security", "Aesthetic"] as const;
export const SEVERITIES = ["Critical", "High", "Medium", "Low"] as const;
export const STATUSES = ["Open", "In Progress", "Resolved", "Closed"] as const;

/** CSS class for a badge - status has a space in it, so strip it. */
export const badgeClass = (value: string) => `badge ${value.replace(/\s+/g, "")}`;
