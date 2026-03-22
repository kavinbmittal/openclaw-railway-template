import { useState, useCallback, useEffect } from"react";
import Sidebar from"./components/Sidebar.jsx";
import Overview from"./pages/Overview.jsx";
import ProjectDetail from"./pages/ProjectDetail.jsx";
import AgentList from"./pages/AgentList.jsx";
import AgentDetail from"./pages/AgentDetail.jsx";
import CreateProject from"./pages/CreateProject.jsx";
import Approvals from"./pages/Approvals.jsx";
import ApprovalDetail from"./pages/ApprovalDetail.jsx";
import Inbox from"./pages/Inbox.jsx";
import Activity from"./pages/Activity.jsx";
import IssueDetail from"./pages/IssueDetail.jsx";
import Costs from"./pages/Costs.jsx";
import OrgChart from"./pages/OrgChart.jsx";
import Workspaces from"./pages/Workspaces.jsx";

/* ── Hash → state parser ──────────────────────────────────────────── */
function parseHash(hash) {
 const raw = (hash ||"").replace(/^#\/?/,"");
 const parts = raw.split("/").filter(Boolean);

 if (parts.length === 0) return { page:"overview" };

 switch (parts[0]) {
  case"overview":
   return { page:"overview" };
  case"issues":
   return { page:"overview" }; // Global issues not standalone; use project tabs
  case"agents":
   if (parts[1]) return { page:"agent-detail", selectedAgent: parts[1] };
   return { page:"agents" };
  case"inbox":
   return { page:"inbox" };
  case"activity":
   return { page:"activity" };
  case"costs":
   return { page:"costs" };
  case"org-chart":
   return { page:"org-chart" };
  case"workspaces":
   return { page:"workspaces" };
  case"create-project":
   return { page:"create-project" };
  case"approvals":
   if (parts[1]) return { page:"approval-detail", approvalId: parts[1] };
   return { page:"approvals" };
  case"projects": {
   const slug = parts[1];
   if (!slug) return { page:"overview" };
   // #/projects/{slug}/issues/{id}
   if (parts[2] ==="issues" && parts[3]) {
    return {
     page:"issue-detail",
     selectedProject: slug,
     issueContext: { projectSlug: slug, issueId: parts[3] },
    };
   }
   // #/projects/{slug}/{tab}
   const tab = parts[2] ||"overview";
   return { page:"project", selectedProject: slug, projectTab: tab };
  }
  default:
   return { page:"overview" };
 }
}

/* ── State → hash builder ─────────────────────────────────────────── */
function buildHash(target, data) {
 switch (target) {
  case"overview":
   return"#/overview";
  case"project":
   return `#/projects/${data}`;
  case"project-tab":
   // data = { slug, tab }
   return data.tab ==="overview"
    ? `#/projects/${data.slug}`
    : `#/projects/${data.slug}/${data.tab}`;
  case"agent-detail":
   return `#/agents/${data}`;
  case"agents":
   return"#/agents";
  case"issues":
   return"#/issues";
  case"issue-detail":
   // data = { projectSlug, issueId }
   return `#/projects/${data.projectSlug}/issues/${data.issueId}`;
  case"inbox":
   return"#/inbox";
  case"activity":
   return"#/activity";
  case"costs":
   return"#/costs";
  case"org-chart":
   return"#/org-chart";
  case"workspaces":
   return"#/workspaces";
  case"create-project":
   return"#/create-project";
  case"approvals":
   return"#/approvals";
  case"approval-detail":
   return `#/approvals/${data}`;
  default:
   return `#/${target}`;
 }
}

export default function App() {
 const initial = parseHash(window.location.hash);
 const [page, setPage] = useState(initial.page);
 const [selectedProject, setSelectedProject] = useState(initial.selectedProject || null);
 const [selectedAgent, setSelectedAgent] = useState(initial.selectedAgent || null);
 const [issueContext, setIssueContext] = useState(initial.issueContext || null);
 const [projectTab, setProjectTab] = useState(initial.projectTab || null);
 const [approvalId, setApprovalId] = useState(initial.approvalId || null);
 const [refreshKey, setRefreshKey] = useState(0);

 /* Apply parsed hash state */
 const applyState = useCallback((s) => {
  setPage(s.page);
  setSelectedProject(s.selectedProject || null);
  setSelectedAgent(s.selectedAgent || null);
  setIssueContext(s.issueContext || null);
  setProjectTab(s.projectTab || null);
  setApprovalId(s.approvalId || null);
  setRefreshKey((k) => k + 1);
 }, []);

 /* Listen for browser back/forward */
 useEffect(() => {
  function onHashChange() {
   applyState(parseHash(window.location.hash));
  }
  window.addEventListener("hashchange", onHashChange);
  return () => window.removeEventListener("hashchange", onHashChange);
 }, [applyState]);

 /* Navigate by updating the hash (which triggers hashchange → state update) */
 const navigate = useCallback((target, data) => {
  const hash = buildHash(target, data);
  if (window.location.hash === hash) {
   // Same hash — force a state refresh without pushState
   applyState(parseHash(hash));
  } else {
   window.location.hash = hash;
  }
 }, [applyState]);

 return (
  <div className="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
   <div className="min-h-0 flex-1 flex overflow-hidden">
    <Sidebar page={page} selectedProject={selectedProject} navigate={navigate} refreshKey={refreshKey} />
    <div className="flex min-w-0 flex-col h-full flex-1">
     <main className="flex-1 p-4 md:p-6 overflow-auto">
      {page ==="overview" && <Overview navigate={navigate} />}
      {page ==="project" && selectedProject && (
       <ProjectDetail projectId={selectedProject} navigate={navigate} initialTab={projectTab} />
      )}
      {page ==="agents" && <AgentList navigate={navigate} />}
      {page ==="agent-detail" && selectedAgent && (
       <AgentDetail agentId={selectedAgent} navigate={navigate} />
      )}
      {page ==="create-project" && <CreateProject navigate={navigate} />}
      {page ==="approvals" && <Approvals navigate={navigate} />}
      {page ==="approval-detail" && approvalId && (
       <ApprovalDetail approvalId={approvalId} navigate={navigate} />
      )}
      {page ==="inbox" && <Inbox navigate={navigate} />}
      {page ==="activity" && <Activity navigate={navigate} />}
      {page ==="costs" && <Costs navigate={navigate} />}
      {page ==="org-chart" && <OrgChart navigate={navigate} />}
      {page ==="workspaces" && <Workspaces navigate={navigate} />}
      {/* Issues are accessed via project detail tabs (#/projects/{slug}/issues) */}
      {page ==="issue-detail" && issueContext && (
       <IssueDetail
        projectSlug={issueContext.projectSlug}
        issueId={issueContext.issueId}
        navigate={navigate}
       />
      )}
     </main>
    </div>
   </div>
  </div>
 );
}
