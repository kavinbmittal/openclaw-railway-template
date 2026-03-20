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

## Mission
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

  return { slug };
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
