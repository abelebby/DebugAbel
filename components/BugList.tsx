"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import BugDetail from "./BugDetail";
import {
  BUG_TYPES,
  SEVERITIES,
  STATUSES,
  badgeClass,
  type Bug,
  type Project,
} from "@/lib/types";

type Filters = {
  project: string;
  feature: string;
  bug_type: string;
  severity: string;
  status: string;
};

const EMPTY: Filters = { project: "", feature: "", bug_type: "", severity: "", status: "" };

export default function BugList({ currentUser }: { currentUser: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [bugs, setBugs] = useState<Bug[]>([]);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [openBug, setOpenBug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
    const response = await fetch(`/api/bugs?${params.toString()}`);
    if (!response.ok) {
      setError("Could not load bugs.");
      setLoading(false);
      return;
    }
    const data = await response.json();
    setBugs(data.bugs);
    setError("");
    setLoading(false);
  }, [filters]);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => (r.ok ? r.json() : { projects: [] }))
      .then((d) => setProjects(d.projects ?? []));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Group bugs: project -> feature -> bugs.
  const grouped = useMemo(() => {
    const map = new Map<string, { project: Bug["project"]; features: Map<string, Bug[]> }>();
    for (const bug of bugs) {
      let entry = map.get(bug.project.id);
      if (!entry) {
        entry = { project: bug.project, features: new Map() };
        map.set(bug.project.id, entry);
      }
      const key = `${bug.feature.id}|${bug.feature.name}`;
      entry.features.set(key, [...(entry.features.get(key) ?? []), bug]);
    }
    return map;
  }, [bugs]);

  const featureOptions = filters.project
    ? (projects.find((p) => p.id === filters.project)?.features ?? [])
    : projects.flatMap((p) => p.features);

  const set = (key: keyof Filters, value: string) =>
    setFilters((f) => ({ ...f, [key]: value, ...(key === "project" ? { feature: "" } : {}) }));

  const isOpen = (key: string) => openGroups[key] !== false; // open by default

  return (
    <div className="container">
      <h1>Bugs</h1>

      <div className="filters">
        <div className="field">
          <label>Project</label>
          <select value={filters.project} onChange={(e) => set("project", e.target.value)}>
            <option value="">All projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Feature</label>
          <select value={filters.feature} onChange={(e) => set("feature", e.target.value)}>
            <option value="">All features</option>
            {featureOptions.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Bug type</label>
          <select value={filters.bug_type} onChange={(e) => set("bug_type", e.target.value)}>
            <option value="">All types</option>
            {BUG_TYPES.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Severity</label>
          <select value={filters.severity} onChange={(e) => set("severity", e.target.value)}>
            <option value="">All severities</option>
            {SEVERITIES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Status</label>
          <select value={filters.status} onChange={(e) => set("status", e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <button onClick={() => setFilters(EMPTY)}>Clear</button>
      </div>

      {error ? <div className="error">{error}</div> : null}

      {loading ? (
        <div className="panel empty">Loading…</div>
      ) : bugs.length === 0 ? (
        <div className="panel empty">
          No bugs match these filters. <Link href="/new">Report one →</Link>
        </div>
      ) : (
        [...grouped.values()].map(({ project, features }) => (
          <section key={project.id}>
            <h2>{project.name}</h2>
            {[...features.entries()].map(([key, featureBugs]) => {
              const groupKey = `${project.id}:${key}`;
              const featureName = key.split("|")[1];
              return (
                <div className="panel group" key={groupKey}>
                  <button
                    className="group-head"
                    onClick={() =>
                      setOpenGroups((g) => ({ ...g, [groupKey]: !isOpen(groupKey) }))
                    }
                  >
                    <span className="chevron">{isOpen(groupKey) ? "▼" : "▶"}</span>
                    <span>{featureName}</span>
                    <span className="count">
                      {featureBugs.length} bug{featureBugs.length === 1 ? "" : "s"}
                    </span>
                  </button>

                  {isOpen(groupKey)
                    ? featureBugs.map((bug) => (
                        <div key={bug.id}>
                          <button
                            className="bug-row"
                            onClick={() => setOpenBug(openBug === bug.id ? null : bug.id)}
                          >
                            <span className="chevron">{openBug === bug.id ? "▼" : "▶"}</span>
                            <span className="bug-num">#{bug.number}</span>
                            <span className="bug-title">{bug.title}</span>
                            <span className={badgeClass(bug.bugType)}>{bug.bugType}</span>
                            <span className={badgeClass(bug.severity)}>{bug.severity}</span>
                            <span className={badgeClass(bug.status)}>{bug.status}</span>
                            <span className="badge source">
                              {bug.source === "agent" ? "via Claude" : "Manual"}
                            </span>
                          </button>
                          {openBug === bug.id ? (
                            <BugDetail
                              bug={bug}
                              currentUser={currentUser}
                              onChanged={load}
                              onDeleted={() => {
                                setOpenBug(null);
                                load();
                              }}
                            />
                          ) : null}
                        </div>
                      ))
                    : null}
                </div>
              );
            })}
          </section>
        ))
      )}
    </div>
  );
}
