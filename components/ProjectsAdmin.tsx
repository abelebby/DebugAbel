"use client";

import { useCallback, useEffect, useState } from "react";
import type { Project } from "@/lib/types";

export default function ProjectsAdmin() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [featureName, setFeatureName] = useState<Record<string, string>>({});
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch("/api/projects");
    if (!response.ok) return setError("Could not load projects.");
    setProjects((await response.json()).projects ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function send(url: string, method: string, body?: unknown) {
    setError("");
    const response = await fetch(url, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      // TEMPORARY DIAGNOSTIC - show the debug field too, remove once fixed.
      setError(data.debug ? `${data.error} — ${data.debug}` : data.error ?? "Something went wrong.");
      return false;
    }
    await load();
    return true;
  }

  return (
    <div className="container">
      <h1>Projects &amp; features</h1>
      {error ? <div className="error">{error}</div> : null}

      <div className="panel" style={{ padding: 18, marginBottom: 22 }}>
        <div className="row">
          <div className="field">
            <label>New project name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. V-DataSuite" />
          </div>
          <div className="field">
            <label>Description (optional)</label>
            <input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <button
          className="primary"
          disabled={name.trim().length === 0}
          onClick={async () => {
            if (await send("/api/projects", "POST", { name, description })) {
              setName("");
              setDescription("");
            }
          }}
        >
          Add project
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="panel empty">No projects yet — add your first one above.</div>
      ) : null}

      {projects.map((project) => (
        <div className="panel group" key={project.id} style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <strong style={{ fontSize: 16 }}>{project.name}</strong>
            <span className="meta">{project.description}</span>
            <span className="spacer" style={{ flex: 1 }} />
            <button
              className="danger"
              onClick={() => {
                if (
                  confirm(`Delete project "${project.name}"? Its features and bugs go with it.`)
                ) {
                  send(`/api/projects/${project.id}`, "DELETE");
                }
              }}
            >
              Delete
            </button>
          </div>

          <ul style={{ margin: "12px 0", paddingLeft: 18 }}>
            {project.features.map((feature) => (
              <li key={feature.id} style={{ marginBottom: 4 }}>
                {feature.name}{" "}
                <button
                  className="link danger"
                  onClick={() => {
                    if (confirm(`Delete feature "${feature.name}" and its bugs?`)) {
                      send(`/api/features/${feature.id}`, "DELETE");
                    }
                  }}
                >
                  delete
                </button>
              </li>
            ))}
            {project.features.length === 0 ? <li className="meta">No features yet.</li> : null}
          </ul>

          <div className="row" style={{ alignItems: "flex-end" }}>
            <input
              placeholder="New feature name"
              value={featureName[project.id] ?? ""}
              onChange={(e) => setFeatureName({ ...featureName, [project.id]: e.target.value })}
            />
            <button
              style={{ flex: "0 0 auto" }}
              disabled={!(featureName[project.id] ?? "").trim()}
              onClick={async () => {
                if (
                  await send("/api/features", "POST", {
                    project_id: project.id,
                    name: featureName[project.id],
                  })
                ) {
                  setFeatureName({ ...featureName, [project.id]: "" });
                }
              }}
            >
              Add feature
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
