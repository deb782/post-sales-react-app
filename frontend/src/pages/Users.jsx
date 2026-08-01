import { useEffect, useState } from "react";
import { api, apiError } from "@/lib/api";
import { useAuth, ROLE_LABELS } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Plus, UserCog, MoreHorizontal, KeyRound, Pencil, Trash2, Copy, RotateCcw } from "lucide-react";
import { toast } from "sonner";

const ALL_ROLES = ["admin", "management", "accounts", "sales", "crm", "site_manager"];

const BLANK = { email: "", name: "", role: "site_manager", phone: "", project_ids: [] };

export default function Users() {
  const { user: me } = useAuth();
  const [items, setItems] = useState([]);
  const [projects, setProjects] = useState([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [invite, setInvite] = useState(BLANK);
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(BLANK);
  const [lastInvite, setLastInvite] = useState(null);
  const [resetResult, setResetResult] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [showInactive, setShowInactive] = useState(false);

  const isAdmin = me.role === "admin";
  const isMgmt = me.role === "management";

  // Management can't touch admins nor promote to admin.
  const canManageThis = (u) => isAdmin || (isMgmt && u.role !== "admin");
  const availableRoles = isAdmin ? ALL_ROLES : ALL_ROLES.filter(r => r !== "admin");

  const load = async () => {
    const [u, p] = await Promise.all([api.get("/users"), api.get("/projects")]);
    setItems(u.data); setProjects(p.data);
  };
  useEffect(() => { load(); }, []);

  const doInvite = async () => {
    try {
      const { data } = await api.post("/users", invite);
      toast.success(`Invited ${data.user.name}${data.email_sent ? " — email sent" : ""}`);
      setLastInvite(data);
      setInvite(BLANK);
      setInviteOpen(false);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const startEdit = (u) => {
    setEditing(u);
    setEditForm({
      name: u.name, email: u.email, role: u.role,
      phone: u.phone || "", project_ids: u.project_ids || [],
    });
  };

  const saveEdit = async () => {
    try {
      await api.patch(`/users/${editing.user_id}`, {
        name: editForm.name,
        phone: editForm.phone,
        role: editForm.role,
        project_ids: editForm.role === "site_manager" ? editForm.project_ids : [],
      });
      toast.success("User updated");
      setEditing(null);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const doReset = async (u) => {
    try {
      const { data } = await api.post(`/users/${u.user_id}/reset-password`);
      setResetResult({ ...data, user: u });
      toast.success(data.email_sent ? "Reset email sent" : "Password reset — share details manually");
    } catch (e) { toast.error(apiError(e)); }
  };

  const doDelete = async () => {
    try {
      await api.delete(`/users/${confirmDel.user_id}`);
      toast.success(`${confirmDel.name} deactivated`);
      setConfirmDel(null);
      load();
    } catch (e) { toast.error(apiError(e)); }
  };

  const doReactivate = async (u) => {
    try { await api.post(`/users/${u.user_id}/reactivate`); toast.success("Reactivated"); load(); }
    catch (e) { toast.error(apiError(e)); }
  };

  const visible = items.filter(u => showInactive || u.is_active);

  return (
    <div className="space-y-6" data-testid="users-root">
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Access control</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Users & Permissions</h1>
          <p className="mt-1 text-stone-500 text-sm">Invite, update, reset passwords, and deactivate people on your team.</p>
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-stone-500 flex items-center gap-2 cursor-pointer">
            <Checkbox checked={showInactive} onCheckedChange={setShowInactive} data-testid="show-inactive-toggle" /> Show inactive
          </label>
          <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-900 hover:bg-emerald-800" data-testid="new-user-btn"><Plus className="w-4 h-4 mr-1" /> Invite user</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>Invite a new teammate</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Field label="Full name *"><Input value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} data-testid="user-name-input" /></Field>
                <Field label="Work email *"><Input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} data-testid="user-email-input" /></Field>
                <Field label="Phone"><Input value={invite.phone} onChange={(e) => setInvite({ ...invite, phone: e.target.value })} placeholder="+91 98200 00000" /></Field>
                <Field label="Role *">
                  <Select value={invite.role} onValueChange={(v) => setInvite({ ...invite, role: v })}>
                    <SelectTrigger data-testid="user-role-select"><SelectValue /></SelectTrigger>
                    <SelectContent>{availableRoles.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                {invite.role === "site_manager" && (
                  <div className="space-y-2 border border-stone-200 rounded-md p-3 max-h-48 overflow-y-auto">
                    <div className="text-xs uppercase tracking-widest text-stone-500">Project access</div>
                    {projects.map(p => (
                      <label key={p.project_id} className="flex items-center gap-2 text-sm">
                        <Checkbox checked={invite.project_ids.includes(p.project_id)}
                          onCheckedChange={(v) => {
                            const next = v ? [...invite.project_ids, p.project_id] : invite.project_ids.filter(x => x !== p.project_id);
                            setInvite({ ...invite, project_ids: next });
                          }} />
                        {p.name}
                      </label>
                    ))}
                    {projects.length === 0 && <div className="text-xs text-stone-500">No projects yet — add one first</div>}
                  </div>
                )}
              </div>
              <DialogFooter><Button onClick={doInvite} className="bg-emerald-900 hover:bg-emerald-800" data-testid="save-user-btn">Send invite</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {(lastInvite || resetResult) && (
        <CredentialsBanner data={lastInvite || resetResult} onClose={() => { setLastInvite(null); setResetResult(null); }} isReset={!!resetResult} />
      )}

      <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Person</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Projects</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map(u => (
              <TableRow key={u.user_id} data-testid={`user-row-${u.email}`} className={u.is_active ? "" : "opacity-50"}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center text-sm font-semibold text-emerald-900">{u.name?.[0]?.toUpperCase()}</div>
                    <div className="min-w-0">
                      <div className="font-medium text-stone-900 truncate">{u.name}</div>
                      <div className="text-xs text-stone-500 truncate">{u.email}</div>
                    </div>
                  </div>
                </TableCell>
                <TableCell><span className="text-xs px-2 py-1 rounded-full bg-stone-100 text-stone-700 font-medium">{ROLE_LABELS[u.role]}</span></TableCell>
                <TableCell>
                  {u.role === "site_manager" ? (
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {(u.project_ids || []).length === 0 && <span className="text-xs text-stone-400">None</span>}
                      {(u.project_ids || []).map(pid => {
                        const p = projects.find(x => x.project_id === pid);
                        return p ? <span key={pid} className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">{p.name}</span> : null;
                      })}
                    </div>
                  ) : <span className="text-xs text-stone-400">Global access</span>}
                </TableCell>
                <TableCell>
                  {u.is_active ? (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">Active</span>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">Inactive</span>
                  )}
                  {u.must_reset_password && <span className="ml-2 text-[10px] text-amber-700">Reset pending</span>}
                </TableCell>
                <TableCell className="text-right">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" data-testid={`user-actions-${u.email}`} disabled={!canManageThis(u)}>
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => startEdit(u)} data-testid={`edit-user-${u.email}`}><Pencil className="w-4 h-4 mr-2" /> Edit details</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => doReset(u)} data-testid={`reset-user-${u.email}`}><KeyRound className="w-4 h-4 mr-2" /> Reset password</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      {u.is_active ? (
                        <DropdownMenuItem onClick={() => setConfirmDel(u)} className="text-rose-700 focus:text-rose-700" data-testid={`deactivate-user-${u.email}`}>
                          <Trash2 className="w-4 h-4 mr-2" /> Deactivate
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem onClick={() => doReactivate(u)} data-testid={`reactivate-user-${u.email}`}>
                          <RotateCcw className="w-4 h-4 mr-2" /> Reactivate
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center py-10 text-stone-500">
                <UserCog className="w-6 h-6 mx-auto mb-2 text-stone-300" /> No users to show
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit {editing?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Field label="Name"><Input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} data-testid="edit-name-input" /></Field>
            <Field label="Email" hint="Email cannot be changed"><Input value={editForm.email} disabled className="opacity-60" /></Field>
            <Field label="Phone"><Input value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} /></Field>
            <Field label="Role">
              <Select value={editForm.role} onValueChange={(v) => setEditForm({ ...editForm, role: v })}>
                <SelectTrigger data-testid="edit-role-select"><SelectValue /></SelectTrigger>
                <SelectContent>{availableRoles.map(r => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            {editForm.role === "site_manager" && (
              <div className="space-y-2 border border-stone-200 rounded-md p-3 max-h-48 overflow-y-auto">
                <div className="text-xs uppercase tracking-widest text-stone-500">Project access</div>
                {projects.map(p => (
                  <label key={p.project_id} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={editForm.project_ids?.includes(p.project_id)}
                      onCheckedChange={(v) => {
                        const next = v ? [...(editForm.project_ids || []), p.project_id] : (editForm.project_ids || []).filter(x => x !== p.project_id);
                        setEditForm({ ...editForm, project_ids: next });
                      }} />
                    {p.name}
                  </label>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} className="bg-emerald-900 hover:bg-emerald-800" data-testid="save-edit-user-btn">Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Deactivate {confirmDel?.name}?</DialogTitle></DialogHeader>
          <div className="text-sm text-stone-600 space-y-2">
            <p>They will lose access immediately. Their historical activity stays intact and you can reactivate them anytime.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDel(null)}>Cancel</Button>
            <Button className="bg-rose-600 hover:bg-rose-700 text-white" onClick={doDelete} data-testid="confirm-deactivate-btn">Deactivate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="text-xs uppercase tracking-widest text-stone-500">{label}</label>
      {hint && <div className="text-[10px] text-stone-400 mt-0.5">{hint}</div>}
      <div className="mt-1">{children}</div>
    </div>
  );
}

function CredentialsBanner({ data, onClose, isReset }) {
  const u = data.user || {};
  const label = isReset ? "Password reset" : "Invite issued";
  return (
    <div className="p-4 rounded-lg border border-emerald-200 bg-emerald-50" data-testid={isReset ? "reset-panel" : "last-invite-panel"}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-emerald-900">{label} for {u.name || u.email}</div>
          <div className="mt-1 text-xs text-stone-700 space-y-0.5 font-mono">
            <div>Portal: {data.login_url}</div>
            <div>Login ID: {u.email}</div>
            <div>Temp password: {data.temp_password}</div>
          </div>
          {!data.email_sent && (
            <div className="mt-2 text-[11px] text-amber-800">Email couldn't be sent — please share these details manually.</div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            navigator.clipboard.writeText(`Portal: ${data.login_url}\nLogin: ${u.email}\nTemp password: ${data.temp_password}`);
            toast.success("Copied");
          }} data-testid="copy-creds-btn"><Copy className="w-3 h-3 mr-1" /> Copy</Button>
          <Button size="sm" variant="ghost" onClick={onClose}>Dismiss</Button>
        </div>
      </div>
    </div>
  );
}
