import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth, can } from "@/lib/auth";
import { useProjectFilter } from "@/components/ProjectFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Boxes, ArrowUp, ArrowDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { downloadExcel, downloadPdf } from "@/lib/exporters";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Stock() {
  const { user } = useAuth();
  const { ProjectFilter, projectId, projects } = useProjectFilter();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ project_id: "", name: "", unit: "pcs", opening: 0, vendor: "" });
  const [move, setMove] = useState(null);
  const [moveForm, setMoveForm] = useState({ kind: "inward", quantity: 0, note: "" });

  const load = async () => {
    const params = projectId ? { project_id: projectId } : {};
    const { data } = await api.get("/stock/items", { params });
    setItems(data);
  };
  useEffect(() => { load(); }, [projectId]);

  const projMap = useMemo(() => Object.fromEntries(projects.map(p => [p.project_id, p.name])), [projects]);

  const save = async () => {
    try {
      await api.post("/stock/items", { ...form, opening: Number(form.opening) || 0 });
      toast.success("Item added");
      setOpen(false); setForm({ project_id: "", name: "", unit: "pcs", opening: 0, vendor: "" });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  const doMove = async () => {
    try {
      await api.post("/stock/movements", {
        item_id: move.item_id,
        kind: moveForm.kind,
        quantity: Number(moveForm.quantity) || 0,
        note: moveForm.note,
      });
      toast.success(`${moveForm.kind === "inward" ? "Inward" : "Outward"} recorded`);
      setMove(null); setMoveForm({ kind: "inward", quantity: 0, note: "" });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Failed"); }
  };

  return (
    <div className="space-y-6" data-testid="stock-root">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500">Site Materials</div>
          <h1 className="text-4xl font-bold text-stone-900 mt-1">Stock Book</h1>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <ProjectFilter />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="export-stock-btn"><Download className="w-4 h-4 mr-1" /> Export</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => downloadExcel("/exports/stock", projectId ? { project_id: projectId } : {}, "stock.xlsx")}><FileSpreadsheet className="w-4 h-4 mr-2" /> Excel (.xlsx)</DropdownMenuItem>
              <DropdownMenuItem onClick={() => downloadPdf("Stock Book", ["Item","Project","Unit","Opening","Inward","Outward","Closing","Vendor"], items.map(it => [it.name, projMap[it.project_id] || "", it.unit, it.opening, it.inward, it.outward, it.closing, it.vendor || ""]), "stock.pdf")}><FileText className="w-4 h-4 mr-2" /> PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {can(user, "super_admin", "process_admin", "site_supervisor") && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button data-testid="new-stock-item-btn" className="bg-emerald-900 hover:bg-emerald-800"><Plus className="w-4 h-4 mr-1" /> Add Item</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Stock Item</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Project" /></SelectTrigger>
                    <SelectContent>{projects.map(p => <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Item name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  <Input placeholder="Unit (bag/kg/pcs/m3)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
                  <Input type="number" placeholder="Opening quantity" value={form.opening} onChange={(e) => setForm({ ...form, opening: e.target.value })} />
                  <Input placeholder="Vendor" value={form.vendor} onChange={(e) => setForm({ ...form, vendor: e.target.value })} />
                </div>
                <DialogFooter><Button data-testid="save-stock-item-btn" onClick={save} className="bg-emerald-900 hover:bg-emerald-800">Add</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="bg-white border border-stone-200 rounded-xl">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Opening</TableHead>
              <TableHead className="text-right">Inward</TableHead>
              <TableHead className="text-right">Outward</TableHead>
              <TableHead className="text-right">Closing</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((it) => (
              <TableRow key={it.item_id}>
                <TableCell className="font-medium">{it.name}</TableCell>
                <TableCell>{projMap[it.project_id] || "—"}</TableCell>
                <TableCell>{it.unit}</TableCell>
                <TableCell className="text-right">{it.opening}</TableCell>
                <TableCell className="text-right text-emerald-800">{it.inward}</TableCell>
                <TableCell className="text-right text-rose-700">{it.outward}</TableCell>
                <TableCell className="text-right font-semibold">{it.closing}</TableCell>
                <TableCell className="text-stone-600">{it.vendor || "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  {can(user, "super_admin", "process_admin", "site_supervisor") && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => { setMove(it); setMoveForm({ kind: "inward", quantity: 0, note: "" }); }} className="text-emerald-800" data-testid={`inward-${it.item_id}`}><ArrowDown className="w-3 h-3 mr-1" />Inward</Button>
                      <Button size="sm" variant="outline" onClick={() => { setMove(it); setMoveForm({ kind: "outward", quantity: 0, note: "" }); }} className="text-rose-700"><ArrowUp className="w-3 h-3 mr-1" />Outward</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow><TableCell colSpan={9} className="text-center py-12 text-stone-500">
                <Boxes className="w-6 h-6 mx-auto mb-2 text-stone-300" /> No items yet
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!move} onOpenChange={(o) => !o && setMove(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{moveForm.kind === "inward" ? "Inward" : "Outward"} — {move?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input type="number" placeholder="Quantity" value={moveForm.quantity} onChange={(e) => setMoveForm({ ...moveForm, quantity: e.target.value })} data-testid="movement-qty-input" />
            <Input placeholder="Note (challan #, purpose…)" value={moveForm.note} onChange={(e) => setMoveForm({ ...moveForm, note: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMove(null)}>Cancel</Button>
            <Button data-testid="confirm-movement-btn" onClick={doMove} className="bg-emerald-900 hover:bg-emerald-800">Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
