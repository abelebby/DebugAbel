"use client";

import { useState } from "react";
import { BUG_TYPES, SEVERITIES, STATUSES, badgeClass, type Bug } from "@/lib/types";

export default function BugDetail({
  bug,
  currentUser,
  onChanged,
  onDeleted,
}: {
  bug: Bug;
  currentUser: string;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    title: bug.title,
    description: bug.description,
    steps_to_reproduce: bug.stepsToReproduce,
    bug_type: bug.bugType,
    severity: bug.severity,
    environment: bug.environment ?? "",
  });

  // Best-effort ownership check for the UI; the server enforces the same rule.
  const canEdit = bug.reporter.trim().toLowerCase() === currentUser.trim().toLowerCase();

  async function send(url: string, method: string, body: unknown) {
    setBusy(true);
    setError("");
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      return false;
    }
    onChanged();
    return true;
  }

  async function deleteBug() {
    setBusy(true);
    setError("");
    const response = await fetch(`/api/bugs/${bug.id}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      setError(data.error ?? "Something went wrong.");
      setConfirmDelete(false);
      return;
    }
    onDeleted();
  }

  return (
    <div className="bug-detail">
      {error ? <div className="error">{error}</div> : null}

      {editing ? (
        <>
          <div className="field">
            <label>Title</label>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Steps to reproduce</label>
            <textarea
              value={draft.steps_to_reproduce}
              onChange={(e) => setDraft({ ...draft, steps_to_reproduce: e.target.value })}
            />
          </div>
          <div className="row">
            <div className="field">
              <label>Bug type</label>
              <select
                value={draft.bug_type}
                onChange={(e) => setDraft({ ...draft, bug_type: e.target.value as Bug["bugType"] })}
              >
                {BUG_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Severity</label>
              <select
                value={draft.severity}
                onChange={(e) => setDraft({ ...draft, severity: e.target.value as Bug["severity"] })}
              >
                {SEVERITIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Environment</label>
              <input
                value={draft.environment}
                onChange={(e) => setDraft({ ...draft, environment: e.target.value })}
              />
            </div>
          </div>
          <div className="inline-actions">
            <button
              className="primary"
              disabled={busy}
              onClick={async () => {
                if (await send(`/api/bugs/${bug.id}`, "PATCH", draft)) setEditing(false);
              }}
            >
              Save changes
            </button>
            <button onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          <h4>Description</h4>
          <p>{bug.description}</p>
          <h4>Steps to reproduce</h4>
          <p>{bug.stepsToReproduce}</p>
          {bug.environment ? (
            <>
              <h4>Environment</h4>
              <p>{bug.environment}</p>
            </>
          ) : null}

          {bug.attachments.length > 0 ? (
            <>
              <h4>Attachments</h4>
              <div className="thumbs">
                {bug.attachments.map((a) =>
                  a.mimetype.startsWith("image/") ? (
                    <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={`/api/attachments/${a.id}`} alt={a.filename} />
                    </a>
                  ) : (
                    <a key={a.id} href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer">
                      {a.filename}
                    </a>
                  ),
                )}
              </div>
            </>
          ) : null}

          <h4>Details</h4>
          <p className="meta">
            Reported by <strong>{bug.reporter}</strong> ({bug.source === "agent" ? "via Claude" : "manual"})
            {" · "}
            {new Date(bug.createdAt).toLocaleString()}
            {bug.updatedAt !== bug.createdAt
              ? ` · updated ${new Date(bug.updatedAt).toLocaleString()}`
              : ""}
          </p>
        </>
      )}

      <h4>Status</h4>
      <div className="inline-actions">
        <select
          value={bug.status}
          disabled={busy}
          style={{ width: 170 }}
          onChange={(e) => send(`/api/bugs/${bug.id}/status`, "PATCH", { status: e.target.value })}
        >
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <span className={badgeClass(bug.status)}>{bug.status}</span>
        {!editing && canEdit ? (
          <button className="link" style={{ marginLeft: 8 }} onClick={() => setEditing(true)}>
            Edit bug
          </button>
        ) : null}
        {!editing && !canEdit ? (
          <span className="meta" style={{ marginLeft: 8 }}>
            Only {bug.reporter} can edit this bug.
          </span>
        ) : null}
        {!editing && !confirmDelete ? (
          <button
            className="link danger"
            style={{ marginLeft: 8 }}
            onClick={() => setConfirmDelete(true)}
          >
            Delete bug
          </button>
        ) : null}
        {!editing && confirmDelete ? (
          <span style={{ marginLeft: 8, display: "flex", gap: 8, alignItems: "center" }}>
            <span className="meta">Delete #{bug.number} permanently?</span>
            <button className="danger" disabled={busy} onClick={deleteBug}>
              Yes, delete
            </button>
            <button disabled={busy} onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </span>
        ) : null}
      </div>

      <h4>Comments ({bug.comments.length})</h4>
      {bug.comments.map((c) => (
        <div className="comment" key={c.id}>
          <div className="who-line">
            <strong>{c.author}</strong> · {new Date(c.createdAt).toLocaleString()}
          </div>
          <p>{c.body}</p>
        </div>
      ))}
      <div style={{ marginTop: 10 }}>
        <textarea
          value={comment}
          placeholder="Add a comment…"
          style={{ minHeight: 60 }}
          onChange={(e) => setComment(e.target.value)}
        />
        <div className="inline-actions">
          <button
            disabled={busy || comment.trim().length === 0}
            onClick={async () => {
              if (await send(`/api/bugs/${bug.id}/comments`, "POST", { body: comment })) {
                setComment("");
              }
            }}
          >
            Comment
          </button>
        </div>
      </div>
    </div>
  );
}
