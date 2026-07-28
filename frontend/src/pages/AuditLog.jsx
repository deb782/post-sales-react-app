import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ScrollText } from "lucide-react";

export default function AuditLog() {
  const [items, setItems] = useState([]);
  useEffect(() => { (async () => setItems((await api.get("/audit-logs")).data))(); }, []);

  return (
    <div className="space-y-6" data-testid="audit-root">
      <div>
        <div className="text-xs uppercase tracking-widest text-stone-500">Trail</div>
        <h1 className="text-4xl font-bold text-stone-900 mt-1">Audit Log</h1>
      </div>
      <div className="bg-white border border-stone-200 rounded-xl divide-y divide-stone-100">
        {items.map(l => (
          <div key={l.log_id} className="p-4 flex gap-4 items-start">
            <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
              <ScrollText className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm">
                <span className="font-medium">{l.action}</span> on <span className="text-stone-600">{l.entity}</span>
                <span className="text-stone-400"> · {l.entity_id.slice(0, 12)}</span>
              </div>
              {Object.keys(l.meta || {}).length > 0 && (
                <div className="text-xs text-stone-500 mt-1 font-mono truncate">{JSON.stringify(l.meta)}</div>
              )}
              <div className="text-[11px] text-stone-400 mt-1">{new Date(l.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="p-10 text-center text-stone-500 text-sm">
            <ScrollText className="w-6 h-6 mx-auto mb-2 text-stone-300" />
            No audit entries yet
          </div>
        )}
      </div>
    </div>
  );
}
