import { useState, useEffect } from "react";
import { getFile, getProjectCosts, getBudgetPolicy, updateBudgetPolicy } from "../api.js";
import {
  ArrowLeft, FileText, Activity, DollarSign, Clock,
  User, Wallet, Target, ShieldCheck, Bot, CircleDot, Pencil,
} from "lucide-react";
import Markdown from "../components/Markdown.jsx";
import { Skeleton } from "../components/ui/Skeleton.jsx";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/Tabs.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { ActivityRow } from "../components/ActivityRow.jsx";
import { QuotaBar } from "../components/QuotaBar.jsx";
import { CostTimeline } from "../components/CostTimeline.jsx";
import { BurnRateIndicator } from "../components/BurnRateIndicator.jsx";
import { BudgetEditModal } from "../components/BudgetEditModal.jsx";
import Issues from "./Issues.jsx";

const TABS = [
  { id: "overview", label: "Overview", icon: FileText },
  { id: "issues", label: "Issues", icon: CircleDot },
  { id: "standups", label: "Standups", icon: Activity },
  { id: "costs", label: "Costs", icon: DollarSign },
  { id: "activity", label: "Activity", icon: Clock },
];

function parseProjectMd(raw) {
  if (!raw) return {};
  const titleMatch = raw.match(/^#\s+(.+)/m);
  const leadMatch = raw.match(/\*\*Lead:\*\*\s*(\S+)/);
  const budgetMatch = raw.match(/\*\*Budget:\*\*\s*(.+)/);
  const statusMatch = raw.match(/\*\*Status:\*\*\s*(\S+)/);
  const createdMatch = raw.match(/\*\*Created:\*\*\s*(\S+)/);
  const missionMatch = raw.match(/## Mission\s*(?:\/\s*Goal)?\n+([\s\S]*?)(?=\n## |$)/);
  const gatesMatch = raw.match(/## Approval Gates\n+([\s\S]*?)(?=\n## |$)/);
  const subagentsMatch = raw.match(/## Sub-agents\n+([\s\S]*?)(?=\n## |$)/);
  return {
    title: titleMatch?.[1] || "",
    lead: leadMatch?.[1] || "unassigned",
    budget: budgetMatch?.[1]?.trim() || "none",
    status: statusMatch?.[1] || "unknown",
    created: createdMatch?.[1] || "",
    mission: missionMatch?.[1]?.trim() || "",
    gates: gatesMatch?.[1]?.trim() || "",
    subagents: subagentsMatch?.[1]?.trim() || "",
  };
}

function parseActivityLog(raw) {
  if (!raw) return [];
  return raw
    .trim()
    .split("\n")
    .filter((l) => l.trim())
    .map((line) => {
      const m = line.match(/^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*\|\s*(\S+)\s*\|\s*(.+)/);
      if (m) return { time: m[1], agent: m[2], event: m[3] };
      return { time: "", agent: "", event: line };
    })
    .reverse();
}

export default function ProjectDetail({ projectId, navigate }) {
  const [tab, setTab] = useState("overview");
  const [projectRaw, setProjectRaw] = useState(null);
  const [milestones, setMilestones] = useState(null);
  const [standups, setStandups] = useState([]);
  const [costs, setCosts] = useState([]);
  const [costSummary, setCostSummary] = useState(null);
  const [budgetPolicy, setBudgetPolicy] = useState(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [activityLog, setActivityLog] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getFile(`shared/projects/${projectId}/PROJECT.md`).catch(() => null),
      getFile(`shared/projects/${projectId}/milestones.md`).catch(() => null),
      getFile(`shared/projects/${projectId}/activity.log`).catch(() => null),
      loadStandups(projectId),
      loadCosts(projectId),
      getProjectCosts(projectId).catch(() => null),
      getBudgetPolicy(projectId).catch(() => null),
    ]).then(([proj, miles, activity, standupList, costList, costData, policyData]) => {
      setProjectRaw(proj?.content || null);
      setMilestones(miles?.content || null);
      setActivityLog(activity?.content || "");
      setStandups(standupList);
      setCosts(costList);
      setCostSummary(costData);
      setBudgetPolicy(policyData?.policy || null);
      setLoading(false);
    });
  }, [projectId]);

  const handleSaveBudget = async (data) => {
    setSavingBudget(true);
    try {
      const result = await updateBudgetPolicy(data);
      setBudgetPolicy(result.policy);
      // Refresh cost summary
      const updated = await getProjectCosts(projectId).catch(() => null);
      if (updated) setCostSummary(updated);
      setShowBudgetModal(false);
    } catch (e) {
      console.error("Failed to save budget:", e);
    } finally {
      setSavingBudget(false);
    }
  };

  const project = parseProjectMd(projectRaw);
  const activities = parseActivityLog(activityLog);
  const totalCost = costs.reduce((sum, c) => sum + (c.total_usd || 0), 0);

  if (loading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb bar */}
      <div className="h-12 flex items-center gap-2">
        <button
          onClick={() => navigate("overview")}
          className="text-[13px] text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </button>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-[13px] font-semibold text-foreground truncate">
          {project.title || projectId}
        </span>
      </div>

      {/* Project header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-xl font-semibold text-foreground">
            {project.title || projectId}
          </h2>
          <StatusBadge status={project.status} />
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User size={12} />
            {project.lead}
          </span>
          <span className="flex items-center gap-1.5 font-mono tabular-nums">
            <Wallet size={12} />
            {project.budget}
          </span>
          {project.created && (
            <span className="flex items-center gap-1.5">
              <Clock size={12} />
              {project.created}
            </span>
          )}
          {totalCost > 0 && (
            <span className="flex items-center gap-1.5 font-mono tabular-nums">
              <DollarSign size={12} />
              ${totalCost.toFixed(2)} spent
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {TABS.map(({ id, label, icon: Icon }) => (
            <TabsTrigger key={id} value={id}>
              <Icon size={14} strokeWidth={1.8} />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview">
          <div className="space-y-4">
            {project.mission && (
              <div className="border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target size={14} className="text-muted-foreground/50" />
                  <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Mission / Goal
                  </h3>
                </div>
                <p className="text-sm text-foreground/80 leading-relaxed">{project.mission}</p>
              </div>
            )}

            {milestones && (
              <div className="border border-border p-4">
                <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-3">
                  Milestones
                </h3>
                <Markdown content={milestones} />
              </div>
            )}

            {project.gates && (
              <div className="border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck size={14} className="text-muted-foreground/50" />
                  <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Approval Gates
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {project.gates
                    .split("\n")
                    .filter(Boolean)
                    .map((gate, i) => {
                      const text = gate.replace(/^-\s*/, "");
                      const [name, requires] = text.split(":").map((s) => s.trim());
                      return (
                        <div key={i} className="flex items-center justify-between py-2 text-sm">
                          <span className="text-foreground/80">{name}</span>
                          {requires && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {requires}
                            </span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {project.subagents && !project.subagents.includes("(none") && (
              <div className="border border-border p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Bot size={14} className="text-muted-foreground/50" />
                  <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    Sub-agents
                  </h3>
                </div>
                <Markdown content={project.subagents} />
              </div>
            )}
          </div>
        </TabsContent>

        {/* Issues tab */}
        <TabsContent value="issues">
          <Issues projectSlug={projectId} navigate={navigate} />
        </TabsContent>

        {/* Standups tab */}
        <TabsContent value="standups">
          {standups.length === 0 ? (
            <EmptyState icon={Activity} text="No standups yet" sub="The lead will post daily updates here." />
          ) : (
            <div className="space-y-3">
              {standups.map((s) => (
                <div key={s.name} className="border border-border p-4">
                  <h4 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-3">
                    {s.name.replace(".md", "")}
                  </h4>
                  <Markdown content={s.content} />
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Costs tab */}
        <TabsContent value="costs">
          <ProjectCostsTab
            costs={costs}
            costSummary={costSummary}
            budgetPolicy={budgetPolicy}
            totalCost={totalCost}
            projectId={projectId}
            onEditBudget={() => setShowBudgetModal(true)}
          />
          {showBudgetModal && (
            <BudgetEditModal
              project={projectId}
              policy={budgetPolicy}
              onSave={handleSaveBudget}
              onClose={() => setShowBudgetModal(false)}
              saving={savingBudget}
            />
          )}
        </TabsContent>

        {/* Activity tab */}
        <TabsContent value="activity">
          {activities.length === 0 ? (
            <EmptyState icon={Clock} text="No activity yet" sub="Events will appear as the project progresses." />
          ) : (
            <div className="border border-border divide-y divide-border">
              {activities.map((a, i) => (
                <ActivityRow
                  key={i}
                  time={a.time}
                  agent={a.agent}
                  event={a.event}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ProjectCostsTab({ costs, costSummary, budgetPolicy, totalCost, projectId, onEditBudget }) {
  const cs = costSummary || {};
  const budget = cs.budget || 0;
  const utilizationPct = cs.utilizationPct || 0;
  const remaining = cs.remaining || 0;
  const dailyBurnRate = cs.dailyBurnRate || 0;
  const exhaustionDate = cs.exhaustionDate;
  const entries = cs.entries || [];
  const agentSummaries = cs.agents || [];

  if (costs.length === 0 && entries.length === 0) {
    return (
      <EmptyState icon={DollarSign} text="No cost data yet" sub="Agents will log their token usage here." />
    );
  }

  return (
    <div className="space-y-4">
      {/* Budget policy card */}
      <div className="border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet size={14} className="text-muted-foreground/50" />
            <h3 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Budget Policy
            </h3>
          </div>
          <button
            onClick={onEditBudget}
            className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
          >
            <Pencil size={12} />
            Edit Budget
          </button>
        </div>

        {budget > 0 && (
          <QuotaBar
            label="Weekly Budget"
            percentUsed={utilizationPct}
            leftLabel={`$${totalCost.toFixed(2)} / $${budget}`}
            rightLabel={`${utilizationPct}%`}
          />
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">Spend</p>
            <p className="text-lg font-semibold font-mono tabular-nums mt-0.5">${totalCost.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">Budget</p>
            <p className="text-lg font-semibold font-mono tabular-nums mt-0.5">
              {budget > 0 ? `$${budget}/wk` : "No cap"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">Remaining</p>
            <p className="text-lg font-semibold font-mono tabular-nums mt-0.5">
              {budget > 0 ? `$${remaining.toFixed(2)}` : "--"}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground/60">Burn Rate</p>
            <div className="mt-0.5">
              <BurnRateIndicator dailyRate={dailyBurnRate} compact />
            </div>
          </div>
        </div>

        {exhaustionDate && (
          <p className="text-xs text-muted-foreground">
            Projected exhaustion: <span className="font-mono tabular-nums">{exhaustionDate}</span>
          </p>
        )}

        {budgetPolicy && (
          <div className="flex gap-4 text-[10px] text-muted-foreground/50 pt-1 border-t border-border/50">
            <span>Warn: {Math.round((budgetPolicy.warn_threshold || 0.8) * 100)}%</span>
            <span>Stop: {Math.round((budgetPolicy.stop_threshold || 1.0) * 100)}%</span>
            {budgetPolicy.per_agent_limits && Object.keys(budgetPolicy.per_agent_limits).length > 0 && (
              <span>
                Agent limits: {Object.entries(budgetPolicy.per_agent_limits)
                  .map(([a, l]) => `${a}: $${l}`)
                  .join(", ")}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-1">
        <MetricCard
          label="Total Spend"
          value={`$${totalCost.toFixed(2)}`}
          mono
        />
        <MetricCard
          label="Entries"
          value={entries.length || costs.reduce((sum, c) => sum + (c.entries?.length || 0), 0)}
        />
      </div>

      {/* Per-agent breakdown */}
      {(agentSummaries.length > 0 || costs.length > 0) && (
        <div>
          <h4 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
            Per-Agent Breakdown
          </h4>
          <div className="border border-border divide-y divide-border">
            {(agentSummaries.length > 0 ? agentSummaries : costs).map((c) => {
              const agentName = c.agent;
              const agentTotal = c.totalUsd ?? c.total_usd ?? 0;
              const agentLimit = budgetPolicy?.per_agent_limits?.[agentName];
              const agentPct = agentLimit ? Math.round((agentTotal / agentLimit) * 100) : null;

              return (
                <div key={agentName} className="px-4 py-3">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium text-foreground">{agentName}</span>
                    <span className="text-sm font-mono tabular-nums text-foreground">
                      ${agentTotal.toFixed(2)}
                    </span>
                  </div>
                  {agentLimit && (
                    <QuotaBar
                      label=""
                      percentUsed={agentPct}
                      leftLabel={`$${agentTotal.toFixed(2)} / $${agentLimit}`}
                      rightLabel={`${agentPct}%`}
                      className="mt-1"
                    />
                  )}
                  <p className="text-[10px] text-muted-foreground/50 mt-1">
                    {c.entryCount ?? c.entries?.length ?? 0} entries
                    {agentLimit ? ` | Limit: $${agentLimit}` : ""}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Cost timeline */}
      {entries.length > 0 && (
        <div>
          <h4 className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-2">
            Cost Timeline
          </h4>
          <CostTimeline entries={entries.slice(0, 50)} />
        </div>
      )}
    </div>
  );
}

async function loadStandups(projectId) {
  try {
    const dir = await getFile(`shared/projects/${projectId}/standups`);
    if (dir.type !== "directory" || !dir.entries) return [];
    const files = dir.entries.filter((e) => e.type === "file" && e.name.endsWith(".md"));
    return Promise.all(
      files.sort((a, b) => b.name.localeCompare(a.name)).slice(0, 7).map(async (f) => {
        const data = await getFile(`shared/projects/${projectId}/standups/${f.name}`);
        return { name: f.name, content: data.content || "" };
      })
    );
  } catch {
    return [];
  }
}

async function loadCosts(projectId) {
  try {
    const dir = await getFile(`shared/projects/${projectId}/costs`);
    if (dir.type !== "directory" || !dir.entries) return [];
    const files = dir.entries.filter((e) => e.type === "file" && e.name.endsWith(".json"));
    return Promise.all(
      files.map(async (f) => {
        const data = await getFile(`shared/projects/${projectId}/costs/${f.name}`);
        return data.content || {};
      })
    );
  } catch {
    return [];
  }
}
