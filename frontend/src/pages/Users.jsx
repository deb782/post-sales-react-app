import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, UserCog } from "lucide-react";
import { toast } from "sonner";
import { ROLE_LABELS } from "@/lib/auth";

const ROLES = ["admin", "management", "accounts", "sales", "crm", "site_manager"];

export default function Users() {
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", name: "", role: "site_manager", project_ids: [] });
  const [lastInvite, setLastInvite] = useState(null);

  const load = async () => {
    const [u, p] = await Promise.all([api.get("/users"), api.get("/projects")]);
    setItems(u.data);
    setProjects(p.data);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    try {
      const { data } = await api.post("/users", form);
      toast.success(`Invited ${data.user.name}${data.email_sent ? " — email sent" : ""}`);
      setLastInvite(data);
      setForm({ email: "", name: "", role: "site_manager", project_ids: [] });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const toggleActive = async (u) => {
    if (u.is_active) {
      await api.delete(`/users/${u.user_id}`);
      toast.success("Deactivated");
    } else {
      await api.patch(`/users/${u.user_id}`, { is_active: true });
      toast.success("Reactivated");
    }
    load();
  };

  const changeRole = async (u, role) => {
    await api.patch(`/users/${u.user_id}`, { role });
    toast.success("Role updated");
    load();
  };

  const toggleProject = async (u, project_id) => {
    const has = u.project_ids?.includes(project_id);
    const next = has ? u.project_ids.filter(x => x !== project_id) : [...(u.project_ids || []), project_id];
    await api.patch(`/users/${u.user_id}`, { project_ids: next });
    load();
  };

  return (
    <div className="space-y-6" data-testid="users-root">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Access</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Users</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button data-testid="new-user-btn" className="bg-emerald-900 hover:bg-emerald-800"><Plus className="w-4 h-4 mr-1" /> New User</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Google email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="user-email-input" />
              <Input placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="space-y-2 border border-stone-200 rounded-md p-3 max-h-48 overflow-y-auto">
                <div className="text-xs uppercase tracking-widest text-stone-500">Project access</div>
                {projects.map(p => (
                  <label key={p.project_id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.project_ids.includes(p.project_id)}
                      onCheckedChange={(v) => {
                        const next = v ? [...form.project_ids, p.project_id] : form.project_ids.filter(x => x !== p.project_id);
                        setForm({ ...form, project_ids: next });
                      }}
                    />
                    {p.name}
                  </label>
                ))}
                {projects.length === 0 && <div className="text-xs text-stone-500">No projects available</div>}
              </div>
            </div>
            <DialogFooter><Button data-testid="save-user-btn" onClick={save} className="bg-emerald-900 hover:bg-emerald-800">Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {lastInvite && (
        <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50" data-testid="last-invite-panel">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold text-emerald-900">Invite ready for {lastInvite.user.name}</div>
              <div className="mt-1 text-xs text-stone-700 space-y-0.5 font-mono">
                <div>Portal: {lastInvite.login_url}</div>
                <div>Login ID: {lastInvite.user.email}</div>
                <div>Temp password: {lastInvite.temp_password}</div>
              </div>
              {!lastInvite.email_sent && (
                <div className="mt-2 text-[11px] text-amber-800">SMTP not configured — please share these details manually.</div>
              )}
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => {
                navigator.clipboard.writeText(`Portal: ${lastInvite.login_url}\nLogin ID: ${lastInvite.user.email}\nTemporary password: ${lastInvite.temp_password}`);
                toast.success("Copied");
              }}>Copy</Button>
              <Button size="sm" variant="outline" onClick={() => setLastInvite(null)}>Dismiss</Button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-stone-200 rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(u => (
              <TableRow key={u.user_id}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell className="text-stone-600">{u.email}</TableCell>
                <TableCell>
                  <Select value={u.role} onValueChange={(v) => changeRole(u, v)}>
                    <SelectTrigger className="h-8 w-40" data-testid={`role-select-${u.email}`}><SelectValue /></SelectTrigger>
                    <SelectContent>{ROLES.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1 max-w-md">
                    {projects.map(p => {
                      const has = u.project_ids?.includes(p.project_id);
                      return (
                        <button key={p.project_id} onClick={() => toggleProject(u, p.project_id)}
                          className={`text-[11px] px-2 py-0.5 rounded-full border ${has ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-stone-50 text-stone-500 border-stone-200"}`}>
                          {p.name}
                        </button>
                      );
                    })}
                  </div>
                </TableCell>
                <TableCell>
                  <Switch checked={u.is_active} onCheckedChange={() => toggleActive(u)} data-testid={`user-active-${u.email}`} />
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-stone-500">
                <UserCog className="w-6 h-6 mx-auto mb-2 text-stone-300" /> No users yet
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
