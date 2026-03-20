import { useState } from "react";
import Sidebar from "./components/Sidebar.jsx";
import Overview from "./pages/Overview.jsx";
import ProjectDetail from "./pages/ProjectDetail.jsx";
import AgentList from "./pages/AgentList.jsx";
import CreateProject from "./pages/CreateProject.jsx";
import Approvals from "./pages/Approvals.jsx";

export default function App() {
  const [page, setPage] = useState("overview");
  const [selectedProject, setSelectedProject] = useState(null);

  function navigate(target, data) {
    if (target === "project" && data) {
      setSelectedProject(data);
      setPage("project");
    } else {
      setSelectedProject(null);
      setPage(target);
    }
  }

  return (
    <div className="flex h-screen">
      <Sidebar page={page} navigate={navigate} />
      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        {page === "overview" && <Overview navigate={navigate} />}
        {page === "project" && selectedProject && (
          <ProjectDetail projectId={selectedProject} navigate={navigate} />
        )}
        {page === "agents" && <AgentList />}
        {page === "create-project" && <CreateProject navigate={navigate} />}
        {page === "approvals" && <Approvals navigate={navigate} />}
      </main>
    </div>
  );
}
