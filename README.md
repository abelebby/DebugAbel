# Bug Tracker

A small internal bug tracker for a testing team. Next.js (App Router) + PostgreSQL,
run locally on each person's own machine against a shared Postgres server.
Attachments live in Postgres as `bytea` — there is no object storage, no cloud
deployment, and no third-party auth.

It is a general-purpose tracker: "Project" is just a label for whichever
application you are currently testing. It never reads or indexes any
application's source code.

---

## 1. First-time setup

You need **Node.js 20+** and access to your team's PostgreSQL server.

1. **Create the database** (once, on the Postgres server):

   ```sql
   CREATE DATABASE bugtracker;
   ```

   Any user that can create tables in that database will do.

2. **Create your `.env`** — copy `.env.example` to `.env` and fill in:

   | Variable         | What it is                                                              |
   | ---------------- | ----------------------------------------------------------------------- |
   | `DATABASE_URL`   | `postgresql://user:password@host:5432/bugtracker?schema=public`          |
   | `AUTH_PASSWORD`  | The shared team password used to log in (min 8 chars)                   |
   | `SESSION_SECRET` | Random string, min 32 chars, used to sign the session cookie            |
   | `PORT`           | Optional, defaults to `3000`                                            |
   | `AGENT_TOKEN`    | Optional extra hardening for the MCP endpoint — see section 5           |

   Generate a session secret with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   **The app refuses to start if `DATABASE_URL`, `AUTH_PASSWORD` or
   `SESSION_SECRET` are missing.** There are no fallback values for secrets
   anywhere in the code, by design.

3. **Run it:**

   - macOS / Linux: `./start.sh` (first time: `chmod +x start.sh`)
   - Windows: double-click `start.bat`

   The script installs dependencies if needed, applies database migrations,
   builds the app, starts it on `127.0.0.1` and opens your browser.

4. **Log in.** Everyone uses the same team password, and each person types their
   own name. That name is recorded as the reporter on bugs you file and as the
   author on your comments, and it is what lets the app tell whose bug is whose.

5. **Add a project and its features** under *Projects & features*, then start
   reporting bugs.

---

## 2. Everyday use

```bash
./start.sh          # normal start
npm run dev         # development mode with hot reload (also localhost-only)
npm run db:generate # after editing db/schema.ts — writes a new SQL migration
npm run db:migrate  # apply pending migrations
```

The app is reachable only at `http://localhost:3000` on the machine running it.
Everyone on the team runs their own copy; they all share one Postgres database,
so everyone sees the same bugs.

---

## 3. What's in the app

- **Bugs list** — grouped into an accordion by Feature within Project. Clicking a
  bug expands it in place: description, steps, attachments, comments, status.
  Filters for project, feature, bug type, severity and status apply across the
  whole list. Every row shows coloured badges plus a "Manual" / "via Claude" tag.
- **Report a bug** — the manual entry form, with screenshot/file attachments.
- **Projects & features** — add or remove projects and the features under them.
  Features are per-project, added as you need them.
- **Dark mode** — the 🌙 / ☀️ button in the header. Follows your system setting
  until you override it; your choice is then remembered in `localStorage`.
- **Editing** — whoever is recorded as a bug's reporter can edit it. Anyone
  logged in can change any bug's status and comment on it. There is no
  tester/developer split — one shared capability set.

---

## 4. API

Every route requires a logged-in session, except the four noted "session or
agent" below — those also accept a loopback-local, optionally token-checked
request with no session, the same way `POST /api/bugs` always has (see
section 6).

| Method | Route                     | Notes                                                             |
| ------ | ------------------------- | ----------------------------------------------------------------- |
| POST   | `/api/auth/login`         | `{ name, password }` → sets the session cookie                    |
| POST   | `/api/auth/logout`        |                                                                    |
| GET    | `/api/bugs`               | **Session or agent.** Filters: `project`, `feature`, `bug_type`, `severity`, `status` |
| POST   | `/api/bugs`               | **Session or agent.** The single creation path — used by the web form *and* the agent |
| GET    | `/api/bugs/:id`           | **Session or agent.**                                              |
| PATCH  | `/api/bugs/:id`           | Edit fields — reporter only                                        |
| DELETE | `/api/bugs/:id`           | Any logged-in user                                                  |
| PATCH  | `/api/bugs/:id/status`    | Status only — any logged-in user                                   |
| POST   | `/api/bugs/:id/comments`  | Author comes from the session, not the request body                |
| GET/POST | `/api/projects`         | List / create                                                      |
| PATCH/DELETE | `/api/projects/:id` |                                                                    |
| POST   | `/api/features`           | Create (needs `project_id`)                                        |
| PATCH/DELETE | `/api/features/:id` |                                                                    |
| GET    | `/api/attachments/:id`    | **Session or agent.** Streams the stored bytes                     |

`POST /api/bugs` accepts either `project_id`/`feature_id` (what the web form
sends) or `project`/`feature` names (what the agent sends — unknown names are
created). It validates every enum value, assigns the next global bug number, and
decodes each entry in `images: [{ data: base64, mimetype, filename }]` into its
own attachment row. Requests carrying a session are recorded as `source: "web"`
and reported under the logged-in name; requests without one can only come from
this machine and are recorded as `source: "agent"`.

`DELETE /api/bugs/:id` used to be reporter-only, matching `PATCH`. It was
opened up to any logged-in user so a bug filed by the MCP agent (whose
`reporter` is whatever name the tester gave it, not a real login) isn't
permanently undeletable by the human team. `PATCH` (editing fields) keeps the
reporter-only restriction.

---

## 5. The Claude agent (MCP server)

`mcp-server/` is a separate Node package that exposes three MCP tools. It holds
no business logic of its own: every tool is a plain HTTP call to this app's own
API, running on the same machine — it never touches Postgres directly.

- **`log_bug`** (write) — testers describe a bug in conversation with Claude,
  and Claude files it after confirming the summary. This is the only tool that
  changes anything.
- **`list_bugs`** (read) — list bugs, optionally filtered by project, feature,
  bug type, severity, or status. Useful for "what's open in V-Sync right now."
- **`get_bug`** (read) — full detail for one bug by its tracker number,
  including comments and any screenshots, meant to hand a debugging agent (or
  you, via conversation) the context needed to actually fix something.

None of the three tools can edit, close, comment on, or delete an existing bug
— there is no tool here that does that; those actions stay in the web UI.

**Setup — one time per person.** With the app installed and running, add this to
Claude Desktop's `claude_desktop_config.json`:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bug-tracker": {
      "command": "node",
      "args": ["C:\\path\\to\\bug-tracker\\mcp-server\\index.js"],
      "env": {
        "BUG_TRACKER_URL": "http://localhost:3000"
      }
    }
  }
}
```

Use the full path to `mcp-server/index.js` on your machine (on macOS/Linux that
looks like `/Users/you/bug-tracker/mcp-server/index.js`). Restart Claude Desktop
afterwards. Claude Desktop launches the server process itself when it needs it —
there is nothing to start manually. The tracker itself does need to be running
(`./start.sh`) for bugs to be filed.

If you set `AGENT_TOKEN` in `.env`, add the same value to the `env` block above:

```json
"env": { "BUG_TRACKER_URL": "http://localhost:3000", "AGENT_TOKEN": "the-same-value" }
```

---

## 6. Security notes

Four paths used by the MCP agent have **no login**: `POST /api/bugs` (file a
bug), `GET /api/bugs` and `GET /api/bugs/:id` (list_bugs / get_bug), and
`GET /api/attachments/:id` (get_bug fetching a screenshot). Only one of the
four can change anything (`POST /api/bugs`) — the other three are reads. All
four share the same protection, not being reachable from anywhere else:

- the server binds to `127.0.0.1` only (`next start -H 127.0.0.1` in
  `package.json`, `start.sh` and `start.bat`), so no other machine can connect;
- the middleware additionally rejects any request to these endpoints that does
  not look loopback-local (`lib/local-only.ts`);
- optionally, `AGENT_TOKEN` adds a shared secret on top, checked on all four.

**Do not change the bind address to `0.0.0.0` and do not put this app behind a
reverse proxy or tunnel.** Doing so would expose these four endpoints —
including the unauthenticated write path — to the network. If you ever need
to, set `AGENT_TOKEN` first.

Everything else in the app requires a session, enforced by middleware that runs
before every route *and* re-checked inside every route handler (the four
agent-reachable reads use `currentSessionOrLocalAgent` in `lib/auth.ts` for
that re-check, instead of `currentSession`). All database access goes through
Drizzle's query builder (parameterized SQL only — no string concatenation
anywhere), and every update/delete is keyed on the record's primary key.

---

## 7. Project layout

```
app/                    Next.js App Router — pages and API routes
  api/                  auth, bugs, projects, features, attachments
components/             React components (list, detail, form, admin, theme)
db/                     Drizzle schema + connection pool
drizzle/                generated SQL migrations
lib/                    env validation, session, auth, validation, local-only guard
mcp-server/             separate MCP package exposing log_bug
middleware.ts           auth gate, runs before every route
start.sh / start.bat    one-step local start
```
