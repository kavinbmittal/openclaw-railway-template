import { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Overview from "./pages/Overview.jsx";
import ProjectDetail from "./pages/ProjectDetail.jsx";
import AgentList from "./pages/AgentList.jsx";
import AgentDetail from "./pages/AgentDetail.jsx";
import CreateProject from "./pages/CreateProject.jsx";
import Approvals from "./pages/Approvals.jsx";
import Inbox from "./pages/Inbox.jsx";
import Activity from "./pages/Activity.jsx";
import Issues from "./pages/Issues.jsx";
import IssueDetail from "./pages/IssueDetail.jsx";
import Costs from "./pages/Costs.jsx";
import OrgChart from "./pages/OrgChart.jsx";
import Workspaces from "./pages/Workspaces.jsx";

export default function App() {
  const [page, setPage] = useState("overview");
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [issueContext, setIssueContext] = useState(null); // { projectSlug, issueId }
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useCallback((target, data) => {
    if (target === "project" && data) {
      setSelectedProject(data);
      setSelectedAgent(null);
      setIssueContext(null);
      setPage("project");
    } else if (target === "agent-detail" && data) {
      setSelectedAgent(data);
      setSelectedProject(null);
      setIssueContext(null);
      setPage("agent-detail");
    } else if (target === "issues" && data) {
      setSelectedProject(data);
      setSelectedAgent(null);
      setIssueContext(null);
      setPage("issues");
    } else if (target === "issue-detail" && data) {
      setSelectedProject(data.projectSlug);
      setSelectedAgent(null);
      setIssueContext(data);
      setPage("issue-detail");
    } else {
      setSelectedProject(null);
      setSelectedAgent(null);
      setIssueContext(null);
      setPage(target);
    }
    setRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="bg-background text-foreground flex h-dvh flex-col overflow-hidden">
      <div className="min-h-0 flex-1 flex overflow-hidden">
        <Sidebar page={page} navigate={navigate} refreshKey={refreshKey} />
        <div className="flex min-w-0 flex-col h-full flex-1">
          <main className="flex-1 p-4 md:p-6 overflow-auto">
            {page === "overview" && <Overview navigate={navigate} />}
            {page === "project" && selectedProject && (
              <ProjectDetail projectId={selectedProject} navigate={navigate} />
            )}
            {page === "agents" && <AgentList navigate={navigate} />}
            {page === "agent-detail" && selectedAgent && (
              <AgentDetail agentId={selectedAgent} navigate={navigate} />
            )}
            {page === "create-project" && <CreateProject navigate={navigate} />}
            {page === "approvals" && <Approvals navigate={navigate} />}
            {page === "inbox" && <Inbox navigate={navigate} />}
            {page === "activity" && <Activity navigate={navigate} />}
            {page === "costs" && <Costs navigate={navigate} />}
            {page === "org-chart" && <OrgChart navigate={navigate} />}
            {page === "workspaces" && <Workspaces navigate={navigate} />}
            {page === "issues" && selectedProject && (
              <Issues projectSlug={selectedProject} navigate={navigate} />
            )}
            {page === "issue-detail" && issueContext && (
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
