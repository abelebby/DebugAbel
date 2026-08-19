"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BUG_TYPES, SEVERITIES, type Project } from "@/lib/types";

type Image = { data: string; mimetype: string; filename: string };

export default function BugForm({ currentUser }: { currentUser: string }) {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({
    project_id: "",
    feature_id: "",
    title: "",
    description: "",
    steps_to_reproduce: "",
    bug_type: "Functional",
    severity: "Medium",
    environment: "",
  });
  const [images, setImages] = useState<Image[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d) => setProjects(d.projects ?? []));
  }, []);

  const features = projects.find((p) => p.id === form.project_id)?.features ?? [];

  async function pickFiles(fileList: FileList | null) {
    if (!fileList) return;
    const next: Image[] = [];
    for (const file of Array.from(fileList).slice(0, 10)) {
      if (file.size > 10 * 1024 * 1024) {
        setError(`${file.name} is larger than 10 MB.`);
        continue;
      }
      const buffer = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buffer);
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      next.push({
        data: btoa(binary),
        mimetype: file.type || "application/octet-stream",
        filename: file.name,
      });
    }
    setImages((existing) => [...existing, ...next].slice(0, 10));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/bugs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, images }),
    });
    const data = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setError(data.error ?? "Could not save the bug.");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="container">
      <h1>Report a bug</h1>
      <form className="panel" style={{ padding: 20 }} onSubmit={submit}>
        {error ? <div className="error">{error}</div> : null}

        <div className="row">
          <div className="field">
            <label>Project *</label>
            <select
              value={form.project_id}
              required
              onChange={(e) => setForm({ ...form, project_id: e.target.value, feature_id: "" })}
            >
              <option value="">Select a project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Feature *</label>
            <select
              value={form.feature_id}
              required
              disabled={!form.project_id}
              onChange={(e) => setForm({ ...form, feature_id: e.target.value })}
            >
              <option value="">Select a feature…</option>
              {features.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Title *</label>
          <input
            value={form.title}
            required
            maxLength={200}
            placeholder="Short summary of the problem"
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Description *</label>
          <textarea
            value={form.description}
            required
            placeholder="What happened, and what did you expect instead?"
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Steps to reproduce *</label>
          <textarea
            value={form.steps_to_reproduce}
            required
            placeholder={"1. Go to…\n2. Click…\n3. Observe…"}
            onChange={(e) => setForm({ ...form, steps_to_reproduce: e.target.value })}
          />
        </div>

        <div className="row">
          <div className="field">
            <label>Bug type *</label>
            <select
              value={form.bug_type}
              onChange={(e) => setForm({ ...form, bug_type: e.target.value })}
            >
              {BUG_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Severity *</label>
            <select
              value={form.severity}
              onChange={(e) => setForm({ ...form, severity: e.target.value })}
            >
              {SEVERITIES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Environment</label>
            <input
              value={form.environment}
              placeholder="e.g. Chrome 127, Windows 11, staging"
              onChange={(e) => setForm({ ...form, environment: e.target.value })}
            />
          </div>
        </div>

        <div className="field">
          <label>Screenshots / attachments (up to 10, 10 MB each)</label>
          <input type="file" multiple accept="image/*,.pdf,.txt,.log" onChange={(e) => pickFiles(e.target.files)} />
          {images.length > 0 ? (
            <ul className="meta" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
              {images.map((image, i) => (
                <li key={`${image.filename}-${i}`}>
                  {image.filename}{" "}
                  <button
                    type="button"
                    className="link"
                    onClick={() => setImages(images.filter((_, index) => index !== i))}
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <p className="meta">This bug will be reported as <strong>{currentUser}</strong>.</p>

        <div className="inline-actions">
          <button className="primary" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Create bug"}
          </button>
          <button type="button" onClick={() => router.push("/")}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
