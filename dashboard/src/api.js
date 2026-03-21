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

export async function getApprovals() {
  const data = await fetchJSON(`${BASE}/approvals`);
  return data.approvals || [];
}

export async function createProject({ name, mission, lead, budget, gates }) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const today = new Date().toISOString().split("T")[0];

  const gateLines = gates
    .filter((g) => g.checked)
    .map((g) => `- ${g.id}: requires kavin`)
    .join("\n");

  const projectMd = `# ${name}

**Lead:** ${lead}
**Budget:** $${budget}/week
**Created:** ${today}
**Status:** active

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

export async function createIssue({ project, title, description, priority, assignee, labels }) {
  const res = await fetch(`${BASE}/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ project, title, description, priority, assignee, labels }),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
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
