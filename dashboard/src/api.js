const BASE = "/mc/api";

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function getProjects() {
  const data = await fetchJSON(`${BASE}/projects`);
  return data.projects || [];
}

export async function getDashboard() {
  return fetchJSON(`${BASE}/dashboard`);
}

export async function getFile(filePath) {
  return fetchJSON(`${BASE}/files?path=${encodeURIComponent(filePath)}`);
}

export async function writeFile(filePath, content) {
  const res = await fetch(`${BASE}/files?path=${encodeURIComponent(filePath)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function deleteFile(filePath) {
  const res = await fetch(`${BASE}/files?path=${encodeURIComponent(filePath)}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function getApprovals(project) {
  const url = project
    ? `${BASE}/approvals?project=${encodeURIComponent(project)}`
    : `${BASE}/approvals`;
  const data = await fetchJSON(url);
  return data.approvals || [];
}

export async function getApprovalDetail(id) {
  return fetchJSON(`${BASE}/approvals/${encodeURIComponent(id)}`);
}

export async function createProject({ name, mission, nsm, lead, budget, gates }) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const today = new Date().toISOString().split("T")[0];

  const gateLines = gates
    .filter((g) => g.checked)
    .map((g) => `- ${g.id}: requires kavin`)
    .join("\n");

  const nsmLine = nsm ? `\n**NSM:** ${nsm}` : "";

  const projectMd = `# ${name}

**Lead:** ${lead}
**Budget:** $${budget}/week
**Created:** ${today}
**Status:** active${nsmLine}

## Mission / Goal
${mission}

## Approval Gates
${gateLines}

## Sub-agents
(none yet)
`;

  const notification = {
    type: "project-assigned",
    to: lead,
    project: slug,
    message: `You've been assigned as lead on ${name}. Read shared/projects/${slug}/PROJECT.md and get started.`,
    created: new Date().toISOString(),
    read: false,
  };

  const timestamp = Date.now();

  await Promise.all([
    writeFile(`shared/projects/${slug}/PROJECT.md`, projectMd),
    writeFile(
      `shared/projects/${slug}/notifications/${timestamp}-assigned.json`,
      JSON.stringify(notification, null, 2)
    ),
    // Scaffold directories — gateway auto-creates parents from .gitkeep files
    writeFile(`shared/projects/${slug}/costs/.gitkeep`, ""),
    writeFile(`shared/projects/${slug}/approvals/pending/.gitkeep`, ""),
    writeFile(`shared/projects/${slug}/approvals/resolved/.gitkeep`, ""),
    writeFile(`shared/projects/${slug}/standups/.gitkeep`, ""),
    writeFile(`shared/projects/${slug}/experiments/.gitkeep`, ""),
    writeFile(`shared/projects/${slug}/issues/.gitkeep`, ""),
    writeFile(`shared/projects/${slug}/themes/.gitkeep`, ""),
  ]);

  // Enable heartbeat cron for the lead agent
  try {
    await fetch("/mc/api/heartbeat/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agent: lead }),
    });
  } catch (_) { /* non-fatal — heartbeat can be enabled manually */ }

  return { slug };
}

// --- Issues API ---

export async function getIssues(projectSlug) {
  const data = await fetchJSON(`${BASE}/issues?project=${encodeURIComponent(projectSlug)}`);
  return data.issues || [];
}

export async function getIssue(id, projectSlug) {
  return fetchJSON(`${BASE}/issues/${encodeURIComponent(id)}?project=${encodeURIComponent(projectSlug)}`);
}

export async function createIssue({ project, title, description, priority, assignee, labels, theme, proxy_metrics, model_override, thinking_override, complexity }) {
  const res = await fetch(`${BASE}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, title, description, priority, assignee, labels, theme, proxy_metrics, model_override, thinking_override, complexity }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function updateIssue(id, projectSlug, updates) {
  const res = await fetch(`${BASE}/issues/${encodeURIComponent(id)}?project=${encodeURIComponent(projectSlug)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function deleteIssue(id, projectSlug) {
  return deleteFile(`shared/projects/${projectSlug}/issues/${id}.json`);
}

export async function addComment(id, projectSlug, text, author) {
  const res = await fetch(`${BASE}/issues/${encodeURIComponent(id)}/comments?project=${encodeURIComponent(projectSlug)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project: projectSlug, text, author }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export async function getInbox() {
  return fetchJSON(`${BASE}/inbox`);
}

export async function getActivity({ limit = 50, project, agent } = {}) {
  const params = new URLSearchParams();
  if (limit) params.set("limit", String(limit));
  if (project) params.set("project", project);
  if (agent) params.set("agent", agent);
  const data = await fetchJSON(`${BASE}/activity?${params}`);
  return data.events || [];
}

// --- Agents API ---

export async function getAgents() {
  const data = await fetchJSON(`${BASE}/agents`);
  return data.agents || [];
}

export async function getAgent(id) {
  const data = await fetchJSON(`${BASE}/agents/${encodeURIComponent(id)}`);
  return data.agent || null;
}

export async function getAgentActivity(id) {
  return fetchJSON(`${BASE}/agents/${encodeURIComponent(id)}/activity`);
}

export async function getAgentRuns(id) {
  const data = await fetchJSON(`${BASE}/agents/${encodeURIComponent(id)}/runs`);
  return data.runs || [];
}

// --- Costs & Budget API ---

export async function getCostOverview() {
  return fetchJSON(`${BASE}/costs/overview`);
}

export async function getProjectCosts(projectSlug) {
  return fetchJSON(`${BASE}/costs?project=${encodeURIComponent(projectSlug)}`);
}

export async function getBudgetPolicy(projectSlug) {
  return fetchJSON(`${BASE}/budget-policy?project=${encodeURIComponent(projectSlug)}`);
}

export async function updateBudgetPolicy({ project, weekly_budget_usd, warn_threshold, stop_threshold, per_agent_limits }) {
  const res = await fetch(`${BASE}/budget-policy`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, weekly_budget_usd, warn_threshold, stop_threshold, per_agent_limits }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

// --- Model Routing API ---

export async function getModelRouting() {
  return fetchJSON(`${BASE}/model-routing`);
}

export async function updateModelRouting({ tiers, agents, research_phases }) {
  const res = await fetch(`${BASE}/model-routing`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tiers, agents, research_phases }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

// --- Projects Summary API ---

export async function getProjectsSummary() {
  const data = await fetchJSON(`${BASE}/projects/summary`);
  return data.projects || [];
}

// --- Org Chart API ---

export async function getOrgChart() {
  const data = await fetchJSON(`${BASE}/org-chart`);
  return data.nodes || [];
}

// --- Workspaces API ---

export async function getWorkspaces({ project, agent, status } = {}) {
  const params = new URLSearchParams();
  if (project) params.set("project", project);
  if (agent) params.set("agent", agent);
  if (status) params.set("status", status);
  const data = await fetchJSON(`${BASE}/workspaces?${params}`);
  return data.workspaces || [];
}

// --- Experiments API ---

export async function getExperiments(projectSlug) {
  const data = await fetchJSON(`${BASE}/experiments?project=${encodeURIComponent(projectSlug)}`);
  return data.experiments || [];
}

export async function createExperiment({ project, name, hypothesis, proxy_metric, target_value, program_md, theme }) {
  const res = await fetch(`${BASE}/experiments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, name, hypothesis, proxy_metric, target_value, program_md, theme }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function getExperiment(dir, projectSlug) {
  return fetchJSON(`${BASE}/experiments/${encodeURIComponent(dir)}?project=${encodeURIComponent(projectSlug)}`);
}

// --- Themes API ---

export async function getThemes(projectSlug) {
  const data = await fetchJSON(`${BASE}/themes?project=${encodeURIComponent(projectSlug)}`);
  return data.themes || [];
}

export async function resolveTheme(projectSlug, themeId, decision, comment) {
  const now = new Date().toISOString();
  const timestamp = Date.now();

  // Read current theme file, update status
  const theme = await fetchJSON(
    `${BASE}/files?path=${encodeURIComponent(`shared/projects/${projectSlug}/themes/${themeId}.json`)}`
  );
  const themeData = typeof theme.content === "string" ? JSON.parse(theme.content) : theme.content;

  if (decision === "approved") {
    themeData.status = "approved";
    themeData.approved_at = now;
  } else if (decision === "rejected") {
    // Delete the theme file
    await deleteFile(`shared/projects/${projectSlug}/themes/${themeId}.json`);

    // Notify agent
    const notification = {
      type: "theme-rejected",
      to: themeData.proposed_by,
      project: projectSlug,
      theme_id: themeId,
      theme_title: themeData.title,
      comment: comment || null,
      created: now,
      read: false,
    };
    await writeFile(
      `shared/projects/${projectSlug}/notifications/${timestamp}-theme-${themeId}.json`,
      JSON.stringify(notification, null, 2)
    );
    return;
  } else if (decision === "revision_requested") {
    themeData.status = "revision_requested";
    themeData.revision_feedback = comment;
    themeData.revision_requested_at = now;
  }

  await writeFile(
    `shared/projects/${projectSlug}/themes/${themeId}.json`,
    JSON.stringify(themeData, null, 2)
  );

  // Notify agent
  const notification = {
    type: `theme-${decision}`,
    to: themeData.proposed_by,
    project: projectSlug,
    theme_id: themeId,
    theme_title: themeData.title,
    comment: comment || null,
    created: now,
    read: false,
  };
  await writeFile(
    `shared/projects/${projectSlug}/notifications/${timestamp}-theme-${themeId}.json`,
    JSON.stringify(notification, null, 2)
  );
}

export async function resolveApproval({ project, id, decision, comment, requester, gate, what, why, created }) {
  const now = new Date().toISOString();
  const timestamp = Date.now();

  const resolved = {
    id,
    project,
    requester,
    gate,
    what,
    why,
    created,
    status: decision,
    resolved_at: now,
    resolved_by: "kavin",
    decision,
    comment: comment || null,
  };

  const tombstone = {
    id,
    status: "resolved",
    resolved_at: now,
    see: `approvals/resolved/${id}.json`,
  };

  const notification = {
    type: "approval-resolved",
    to: requester,
    project,
    approval_id: id,
    decision,
    comment: comment || null,
    created: now,
    read: false,
  };

  await Promise.all([
    writeFile(`shared/projects/${project}/approvals/resolved/${id}.json`, JSON.stringify(resolved, null, 2)),
    writeFile(`shared/projects/${project}/approvals/pending/${id}.json`, JSON.stringify(tombstone, null, 2)),
    writeFile(`shared/projects/${project}/notifications/${timestamp}-approval-${id}.json`, JSON.stringify(notification, null, 2)),
  ]);
}

export async function requestRevision({ project, id, feedback, requester, gate, what, why, created, isIssue }) {
  const now = new Date().toISOString();
  const timestamp = Date.now();

  const notification = {
    type: "approval-revision-requested",
    to: requester,
    project,
    approval_id: id,
    feedback,
    created: now,
    read: false,
  };

  if (isIssue) {
    // Update the issue file in-place with revision status + feedback
    await Promise.all([
      updateIssue(id, project, {
        status: "revision_requested",
        revision_feedback: feedback,
        revision_requested_at: now,
        revision_requested_by: "kavin",
      }),
      writeFile(`shared/projects/${project}/notifications/${timestamp}-revision-${id}.json`, JSON.stringify(notification, null, 2)),
    ]);
  } else {
    // Update the pending approval in-place with revision status + feedback
    const updated = {
      id,
      project,
      requester,
      gate,
      what,
      why,
      created,
      status: "revision_requested",
      revision_feedback: feedback,
      revision_requested_at: now,
      revision_requested_by: "kavin",
    };

    await Promise.all([
      writeFile(`shared/projects/${project}/approvals/pending/${id}.json`, JSON.stringify(updated, null, 2)),
      writeFile(`shared/projects/${project}/notifications/${timestamp}-revision-${id}.json`, JSON.stringify(notification, null, 2)),
    ]);
  }
}
