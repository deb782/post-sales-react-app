import { useEffect, useState } from "react";
import { api, API_BASE } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Download, Upload, FileSpreadsheet } from "lucide-react";

const KINDS = [
  { key: "projects", label: "Projects", cols: ["name", "location", "description", "target_revenue"] },
  { key: "units", label: "Units", cols: ["project_id", "unit_type", "unit_number", "price"] },
  { key: "stock_items", label: "Stock Items", cols: ["project_id", "name", "unit", "opening", "vendor"] },
];

export default function ImportExcel() {
  const [file, setFile] = useState(null);
  const [kind, setKind] = useState("projects");
  const [result, setResult] = useState(null);

  const downloadTemplate = async (k) => {
    const token = localStorage.getItem("session_token") || "";
    const r = await fetch(`${API_BASE}/excel/template/${k}`, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!r.ok) { toast.error("Download failed"); return; }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `template_${k}.xlsx`;
    a.click();
  };

  const doImport = async () => {
    if (!file) { toast.error("Choose an .xlsx file"); return; }
    const fd = new FormData();
    fd.append("file", file);
    try {
      const { data } = await api.post(`/excel/import/${kind}`, fd);
      setResult(data);
      toast.success(`Imported ${data.inserted} row(s)`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Import failed");
    }
  };

  return (
    <div className="space-y-6" data-testid="import-root">
      <div>
        <div className="text-xs uppercase tracking-widest text-stone-500">Bulk</div>
        <h1 className="text-4xl font-bold text-stone-900 mt-1">Excel Import</h1>
        <p className="text-stone-500 text-sm mt-1">Download a template, fill it in, upload back.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {KINDS.map(k => (
          <div key={k.key} className="kpi-card">
            <div className="flex items-start justify-between">
              <div>
                <div className="kpi-label">{k.label}</div>
                <div className="text-xs text-stone-500 mt-2">Columns: {k.cols.join(", ")}</div>
              </div>
              <FileSpreadsheet className="w-6 h-6 text-emerald-800" />
            </div>
            <Button variant="outline" className="mt-4" onClick={() => downloadTemplate(k.key)} data-testid={`download-template-${k.key}`}>
              <Download className="w-3 h-3 mr-1" /> Template
            </Button>
          </div>
        ))}
      </div>

      <div className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <div className="text-sm font-semibold">Upload file</div>
        <div className="flex flex-wrap gap-3 items-center">
          <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-10 rounded-md border border-stone-200 px-3 text-sm" data-testid="import-kind-select">
            {KINDS.map(k => <option key={k.key} value={k.key}>{k.label}</option>)}
          </select>
          <Input type="file" accept=".xlsx" onChange={(e) => setFile(e.target.files?.[0] || null)} className="max-w-md" data-testid="import-file-input" />
          <Button onClick={doImport} className="bg-emerald-900 hover:bg-emerald-800" data-testid="run-import-btn"><Upload className="w-4 h-4 mr-1" /> Import</Button>
        </div>
        {result && (
          <div className="mt-4 text-sm">
            <div>Inserted: <span className="font-semibold text-emerald-800">{result.inserted}</span></div>
            {result.errors?.length > 0 && (
              <div className="mt-2">
                <div className="font-semibold text-rose-700 mb-1">Errors ({result.errors.length}):</div>
                <ul className="text-xs text-stone-600 space-y-0.5 max-h-40 overflow-y-auto">
                  {result.errors.map((er, i) => <li key={i}>Row {er.row}: {er.error}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
