# Bug Tracker

A small internal bug tracker for a testing team. Next.js (App Router) + PostgreSQL,
deployed on Netlify against the team's existing shared Postgres server.
Attachments live in Postgres as `bytea` — there is no object storage and no
third-party auth (see §8 for the current deployment model).

It is a general-purpose tracker: "Project" is just a label for whichever
application you are currently testing. It never reads or indexes any
application's source code.

---

## 1. First-time setup (local development)

The team uses the app at its deployed Netlify URL day to day (§8) — this
section is for running a copy locally to develop/test changes before pushing.
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
   | `AGENT_TOKEN`    | Required — shared secret the MCP agent must send, see section 5        |

   Generate a session secret with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

   **The app refuses to start if `DATABASE_URL`, `AUTH_PASSWORD`,
   `SESSION_SECRET` or `AGENT_TOKEN` are missing.** There are no fallback
   values for secrets anywhere in the code, by design.

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

**For the team:** just open the deployed Netlify URL and log in — see §8.
Nobody needs to run anything locally day to day.

**For local development only:**

```bash
./start.sh          # normal start
npm run dev         # development mode with hot reload (also localhost-only)
npm run db:generate # after editing db/schema.ts — writes a new SQL migration
npm run db:migrate  # apply pending migrations
```

A local copy run this way is reachable only at `http://localhost:3000` on the
machine running it, and talks to the same shared Postgres database everyone
else does — so everyone sees the same bugs regardless of whether they're
using the local dev server or the deployed site.

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
agent" below — those also accept a request with no session that carries a
valid `AGENT_TOKEN`, the same way `POST /api/bugs` always has (see
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
and reported under the logged-in name; requests without one must carry a
valid `AGENT_TOKEN` and are recorded as `source: "agent"`.

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

**Setup — one time per person.** The tracker is now hosted (see §8), so
`mcp-server/index.js` runs on your own machine (Claude Desktop launches it)
but talks to the deployed site over the internet, not to a local copy. Either
install the packaged `.mcpb` extension (rebuilt with `npx @anthropic-ai/mcpb
pack` after any change to `mcp-server/`) and fill in its two fields — Bug
Tracker URL and Agent Token — or add this to Claude Desktop's
`claude_desktop_config.json` by hand:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "bug-tracker": {
      "command": "node",
      "args": ["C:\\path\\to\\bug-tracker\\mcp-server\\index.js"],
      "env": {
        "BUG_TRACKER_URL": "https://your-site.netlify.app",
        "AGENT_TOKEN": "the-same-value-as-the-deployment's-AGENT_TOKEN"
      }
    }
  }
}
```

Use the full path to `mcp-server/index.js` on your machine (on macOS/Linux that
looks like `/Users/you/bug-tracker/mcp-server/index.js`). Restart Claude Desktop
afterwards. Claude Desktop launches the server process itself when it needs it —
there is nothing to start manually. **`AGENT_TOKEN` is no longer optional** —
without it, every call from any of these three tools is rejected (see §6).

---

## 6. Security notes

Four paths used by the MCP agent have **no login**: `POST /api/bugs` (file a
bug), `GET /api/bugs` and `GET /api/bugs/:id` (list_bugs / get_bug), and
`GET /api/attachments/:id` (get_bug fetching a screenshot). Only one of the
four can change anything (`POST /api/bugs`) — the other three are reads.

Now that the app is deployed on the public internet (see §8), the old
"unreachable except from this machine" boundary no longer applies. **The
only protection on all four paths is `AGENT_TOKEN`** — a required shared
secret, checked in both `middleware.ts` and each route's own handler
(`lib/auth.ts`'s `currentSessionOrLocalAgent`, `lib/local-only.ts`'s
`agentTokenOk`). There is no fallback: the app refuses to boot without it set
(`instrumentation.ts`). The MCP server must send the identical value as the
`x-agent-token` header on every call, or its requests are rejected with 401.
Treat this token like a password — anyone who has it can file, list, and read
every bug and attachment (never edit, close, or delete — no tool does that).

Everything else in the app requires a session, enforced by middleware that runs
before every route *and* re-checked inside every route handler. All database
access goes through Drizzle's query builder (parameterized SQL only — no
string concatenation anywhere), and every update/delete is keyed on the
record's primary key.

---

## 8. Deployment (Netlify)

The app is deployed on Netlify, connected to this repo's `main` branch —
Netlify auto-detects Next.js and builds/deploys on every push, no
`netlify.toml` needed. It talks to the same shared PostgreSQL server the team
has always used (see `DATABASE_URL`) — no data migration, no schema change.

**One-time setup:**

1. In Netlify: **Add new site → Import an existing project**, connect this
   GitHub repo, branch `main`. Build command and output are auto-detected.
2. Under **Site settings → Environment variables**, set every variable from
   `.env.example`: `DATABASE_URL`, `AUTH_PASSWORD`, `SESSION_SECRET`, and the
   now-required `AGENT_TOKEN`. (`HOST`/`PORT` aren't used on Netlify — those
   are for local dev only.)
3. **Database reachability:** Netlify's free-tier functions don't have a
   fixed outbound IP address, so the Postgres server's security group /
   firewall needs to accept connections from any IP (`0.0.0.0/0` on the
   Postgres port), relying on the password + `sslmode` in `DATABASE_URL` for
   protection rather than an IP allowlist. If the server is currently locked
   down to specific office/VPN IPs, that rule needs to be opened up (or
   replaced with a paid static-IP add-on) before the deployed app can connect
   — otherwise every request will simply time out.
4. Deploy, then confirm the live URL loads the login page.

**Rolling out to the team:** rebuild the `.mcpb` package
(`npx @anthropic-ai/mcpb pack` inside `mcp-server/`) and have everyone
reinstall it in Claude Desktop with the live Netlify URL and the
`AGENT_TOKEN` value filled in (see §5). Everyone keeps using the same shared
`AUTH_PASSWORD` + their own display name to log into the web UI, exactly as
before — only the address changed, from `localhost:3000` to the Netlify URL.

**Known limits of this pass (deliberately deferred, not forgotten):**
- Still the shared-password login, not individual accounts — that's a
  separate follow-up (see the project's migration game plan).
- Serverless functions on most hosts (Netlify included) cap request/response
  bodies at a few MB — a bug report with very large screenshots could fail
  where it wouldn't have locally. Not expected to bite at normal usage, but
  worth knowing if a `log_bug`/upload call errors out unexpectedly.

---

## 9. Project layout

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
