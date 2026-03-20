import { useState, useCallback } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Overview from "./pages/Overview.jsx";
import ProjectDetail from "./pages/ProjectDetail.jsx";
import AgentList from "./pages/AgentList.jsx";
import CreateProject from "./pages/CreateProject.jsx";
import Approvals from "./pages/Approvals.jsx";

export default function App() {
  const [page, setPage] = useState("overview");
  const [selectedProject, setSelectedProject] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const navigate = useCallback((target, data) => {
    if (target === "project" && data) {
      setSelectedProject(data);
      setPage("project");
    } else {
      setSelectedProject(null);
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
            {page === "agents" && <AgentList />}
            {page === "create-project" && <CreateProject navigate={navigate} />}
            {page === "approvals" && <Approvals navigate={navigate} />}
          </main>
        </div>
      </div>
    </div>
  );
}
