import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth";

export function useProjectFilter() {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [projectId, setProjectId] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/projects");
        setProjects(data);
        if (user.role === "site_manager" && data.length > 0 && !projectId) {
          setProjectId(data[0].project_id);
        }
      } catch (_e) { /* ignore */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const ProjectFilter = () => (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-widest text-stone-500">Project</span>
      <Select value={projectId || "all"} onValueChange={(v) => setProjectId(v === "all" ? "" : v)}>
        <SelectTrigger data-testid="project-filter" className="w-56 bg-white">
          <SelectValue placeholder="All projects" />
        </SelectTrigger>
        <SelectContent>
          {user.role !== "site_manager" && <SelectItem value="all">All projects</SelectItem>}
          {projects.map((p) => (
            <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return { ProjectFilter, projectId, projects };
}
