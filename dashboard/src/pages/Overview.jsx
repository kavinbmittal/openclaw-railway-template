import { useState, useEffect } from "react";
import { getProjects } from "../api.js";
import { FolderKanban, User, DollarSign, ArrowRight } from "lucide-react";
import { Skeleton } from "../components/ui/Skeleton.jsx";
import { MetricCard } from "../components/MetricCard.jsx";
import { StatusBadge, STATUS_DOT } from "../components/StatusBadge.jsx";
import { EmptyState } from "../components/EmptyState.jsx";
import { EntityRow } from "../components/EntityRow.jsx";

export default function Overview({ navigate }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getProjects()
      .then(setProjects)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-12" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="border border-border p-4">
              <Skeleton className="h-4 w-20 mb-3" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-destructive">Error: {error}</p>
      </div>
    );
  }

  const activeCount = projects.filter((p) => p.status === "active").length;
  const totalBudget = projects
    .map((p) => {
      const match = p.budget?.match(/\$(\d+)/);
      return match ? parseInt(match[1]) : 0;
    })
    .reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6">
      {/* Breadcrumb bar */}
      <div className="h-12 flex items-center">
        <h1 className="text-sm font-semibold uppercase tracking-wider">Dashboard</h1>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
        <MetricCard label="Projects" value={projects.length} />
        <MetricCard label="Active" value={activeCount} />
        <MetricCard label="Weekly Budget" value={`$${totalBudget}`} mono />
        <MetricCard label="Agents" value="9" />
      </div>

      {/* Projects section */}
      <div>
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Projects
        </h3>

        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            text="No projects yet"
            sub="Create a project directory in shared/projects/"
          />
        ) : (
          <div className="border border-border divide-y divide-border">
            {projects.map((project) => (
              <EntityRow
                key={project.id}
                onClick={() => navigate("project", project.id)}
                leading={
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      STATUS_DOT[project.status] || STATUS_DOT.unknown
                    }`}
                  />
                }
                title={project.title}
                trailing={
                  <>
                    <StatusBadge status={project.status} />
                    <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                      <User size={12} />
                      {project.lead}
                    </span>
                    <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
                      {project.budget}
                    </span>
                    <ArrowRight size={14} className="text-muted-foreground/50 shrink-0" />
                  </>
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
