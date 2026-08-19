#!/usr/bin/env node
/**
 * Bug Tracker MCP server.
 *
 * A thin adapter with no business logic of its own: every tool below just
 * turns a call into an HTTP request against the Bug Tracker's own API,
 * running on this same machine. It never talks to Postgres directly.
 *
 * Tools:
 *   - log_bug    (write) file a new bug report
 *   - list_bugs  (read)  list bugs, optionally filtered
 *   - get_bug    (read)  full detail for one bug by its tracker number,
 *                        including any screenshots, for debugging context
 *
 * Claude Desktop launches this process itself - there is no manual start step.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const BASE_URL = (process.env.BUG_TRACKER_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const AGENT_TOKEN = process.env.AGENT_TOKEN ?? "";

const INSTRUCTIONS = `You help testers log bugs into the team's bug tracker by having a natural conversation, and you help developers pull up existing bugs for debugging.

FILING (log_bug): ask whatever is missing from the required fields before filing - do not guess at severity, bug type, or which feature the bug belongs to if the tester has not said. If the tester has not told you their name, ask for it; it is recorded as the reporter. Always summarise what you are about to log (project, feature, title, description, steps to reproduce, bug type, severity, environment, reporter) and get an explicit go-ahead before calling log_bug.

READING (list_bugs, get_bug): these are read-only - they never change anything in the tracker. Use list_bugs to find which bug(s) a developer means (e.g. "what's open in V-Sync right now"), then get_bug with the bug's number for full detail, including its screenshots, before diagnosing or proposing a fix.

You never edit, close, comment on, or delete an existing bug through these tools - there is no tool here that does that. If you are unsure about anything, ask rather than guess.`;

const LOG_BUG_TOOL = {
  name: "log_bug",
  description:
    "File a new bug report in the team's bug tracker. Only call this after the tester has confirmed the summary of what will be logged.",
  inputSchema: {
    type: "object",
    properties: {
      project: { type: "string", description: "Name of the project (application) being tested." },
      feature: {
        type: "string",
        description: "Name of the feature within the project that the bug belongs to.",
      },
      title: { type: "string", description: "Short one-line summary of the bug." },
      description: {
        type: "string",
        description: "What happens, and what the tester expected instead.",
      },
      steps_to_reproduce: {
        type: "string",
        description: "Numbered steps someone else can follow to see the bug.",
      },
      bug_type: { type: "string", enum: ["Functional", "Security", "Aesthetic"] },
      severity: { type: "string", enum: ["Critical", "High", "Medium", "Low"] },
      environment: {
        type: "string",
        description: "Optional: browser, OS, build or environment the bug was seen in.",
      },
      reporter_name: { type: "string", description: "Name of the tester reporting the bug." },
      images: {
        type: "array",
        description: "Optional screenshots or files to attach.",
        items: {
          type: "object",
          properties: {
            data: { type: "string", description: "Base64-encoded file contents." },
            mimetype: { type: "string", description: "e.g. image/png" },
            filename: { type: "string" },
          },
          required: ["data", "mimetype", "filename"],
        },
      },
    },
    required: [
      "project",
      "feature",
      "title",
      "description",
      "steps_to_reproduce",
      "bug_type",
      "severity",
      "reporter_name",
    ],
  },
};

const LIST_BUGS_TOOL = {
  name: "list_bugs",
  description:
    "List bugs in the tracker, optionally filtered by project, feature, bug type, severity, or status. Read-only - never changes anything. Use this to find which bug(s) to investigate, then get_bug for full detail.",
  inputSchema: {
    type: "object",
    properties: {
      project: { type: "string", description: "Optional: only bugs under this project name." },
      feature: { type: "string", description: "Optional: only bugs under this feature name." },
      bug_type: { type: "string", enum: ["Functional", "Security", "Aesthetic"] },
      severity: { type: "string", enum: ["Critical", "High", "Medium", "Low"] },
      status: { type: "string", enum: ["Open", "In Progress", "Resolved", "Closed"] },
    },
  },
};

const GET_BUG_TOOL = {
  name: "get_bug",
  description:
    "Fetch full detail for one bug by its tracker number (the \"#48\" shown in the UI): description, steps to reproduce, status, comments, and any screenshot attachments. Read-only - never changes anything.",
  inputSchema: {
    type: "object",
    properties: {
      number: { type: "integer", description: "The bug's tracker number, e.g. 48 for \"Bug #48\"." },
    },
    required: ["number"],
  },
};

const server = new Server(
  { name: "bug-tracker", version: "1.1.0" },
  { capabilities: { tools: {} }, instructions: INSTRUCTIONS },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [LOG_BUG_TOOL, LIST_BUGS_TOOL, GET_BUG_TOOL],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = request.params.arguments ?? {};
  switch (request.params.name) {
    case LOG_BUG_TOOL.name:
      return logBug(args);
    case LIST_BUGS_TOOL.name:
      return listBugs(args);
    case GET_BUG_TOOL.name:
      return getBug(args);
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }
});

function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (AGENT_TOKEN) headers["x-agent-token"] = AGENT_TOKEN;
  return headers;
}

async function logBug(args) {
  let response;
  try {
    response = await fetch(`${BASE_URL}/api/bugs`, {
      method: "POST",
      headers: authHeaders({ "content-type": "application/json" }),
      body: JSON.stringify({ ...args, reporter: args.reporter_name, source: "agent" }),
    });
  } catch (error) {
    return textResult(
      `Could not reach the bug tracker at ${BASE_URL}. Is it running? (${error.message})`,
      true,
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return textResult(
      `The bug tracker rejected the report (HTTP ${response.status}): ${payload.error ?? "unknown error"}`,
      true,
    );
  }

  const bug = payload.bug ?? {};
  return textResult(
    `Logged Bug #${bug.number} - "${bug.title}" under ${bug.project?.name} / ${bug.feature?.name} ` +
      `(${bug.bugType}, ${bug.severity}), reported by ${bug.reporter}.`,
  );
}

async function listBugs(args) {
  const params = new URLSearchParams();
  if (args.bug_type) params.set("bug_type", args.bug_type);
  if (args.severity) params.set("severity", args.severity);
  if (args.status) params.set("status", args.status);

  let response;
  try {
    response = await fetch(`${BASE_URL}/api/bugs?${params.toString()}`, {
      headers: authHeaders(),
    });
  } catch (error) {
    return textResult(
      `Could not reach the bug tracker at ${BASE_URL}. Is it running? (${error.message})`,
      true,
    );
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return textResult(
      `The bug tracker rejected the request (HTTP ${response.status}): ${payload.error ?? "unknown error"}`,
      true,
    );
  }

  let rows = payload.bugs ?? [];
  if (args.project) {
    const wanted = args.project.trim().toLowerCase();
    rows = rows.filter((b) => b.project.name.trim().toLowerCase() === wanted);
  }
  if (args.feature) {
    const wanted = args.feature.trim().toLowerCase();
    rows = rows.filter((b) => b.feature.name.trim().toLowerCase() === wanted);
  }

  if (rows.length === 0) return textResult("No bugs match those filters.");

  const lines = rows.map(
    (b) =>
      `#${b.number} [${b.status}, ${b.severity}, ${b.bugType}] ${b.title} — ` +
      `${b.project.name} / ${b.feature.name} — reported by ${b.reporter} ` +
      `(${b.source === "agent" ? "via Claude" : "manual"})`,
  );
  return textResult(`${rows.length} bug(s):\n${lines.join("\n")}`);
}

async function getBug(args) {
  // The tracker's routes key on an internal id, but people refer to bugs by
  // their tracker number ("Bug #48") - resolve number -> id via the list
  // first, same as a human scanning the accordion for the right row.
  let listResponse;
  try {
    listResponse = await fetch(`${BASE_URL}/api/bugs`, { headers: authHeaders() });
  } catch (error) {
    return textResult(
      `Could not reach the bug tracker at ${BASE_URL}. Is it running? (${error.message})`,
      true,
    );
  }
  const listPayload = await listResponse.json().catch(() => ({}));
  if (!listResponse.ok) {
    return textResult(
      `The bug tracker rejected the request (HTTP ${listResponse.status}): ${listPayload.error ?? "unknown error"}`,
      true,
    );
  }
  const match = (listPayload.bugs ?? []).find((b) => b.number === args.number);
  if (!match) return textResult(`No bug numbered #${args.number} found.`, true);

  const detailResponse = await fetch(`${BASE_URL}/api/bugs/${match.id}`, { headers: authHeaders() });
  const detailPayload = await detailResponse.json().catch(() => ({}));
  if (!detailResponse.ok) {
    return textResult(
      `The bug tracker rejected the request (HTTP ${detailResponse.status}): ${detailPayload.error ?? "unknown error"}`,
      true,
    );
  }
  const bug = detailPayload.bug;

  const summaryLines = [
    `Bug #${bug.number}: ${bug.title}`,
    `${bug.project.name} / ${bug.feature.name} — ${bug.bugType}, ${bug.severity}, ${bug.status}`,
    `Reported by ${bug.reporter} (${bug.source === "agent" ? "via Claude" : "manual"}) on ${new Date(bug.createdAt).toLocaleString()}`,
    "",
    `Description:\n${bug.description}`,
    "",
    `Steps to reproduce:\n${bug.stepsToReproduce}`,
  ];
  if (bug.environment) summaryLines.push("", `Environment: ${bug.environment}`);
  summaryLines.push("", `Comments (${bug.comments.length}):`);
  summaryLines.push(
    ...bug.comments.map(
      (c) => `  - ${c.author} (${new Date(c.createdAt).toLocaleString()}): ${c.body}`,
    ),
  );
  const summary = summaryLines.join("\n");

  const content = [{ type: "text", text: summary }];

  const images = (bug.attachments ?? []).filter((a) => a.mimetype.startsWith("image/"));
  for (const attachment of images) {
    try {
      const attachmentResponse = await fetch(`${BASE_URL}/api/attachments/${attachment.id}`, {
        headers: authHeaders(),
      });
      if (!attachmentResponse.ok) continue;
      const buffer = Buffer.from(await attachmentResponse.arrayBuffer());
      content.push({ type: "image", data: buffer.toString("base64"), mimeType: attachment.mimetype });
    } catch {
      // Skip a screenshot that fails to fetch rather than failing the whole call.
    }
  }

  return { content, isError: false };
}

function textResult(text, isError = false) {
  return { content: [{ type: "text", text }], isError };
}

await server.connect(new StdioServerTransport());
