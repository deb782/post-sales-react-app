import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { api, apiError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Printer, Download, FileText } from "lucide-react";
import { toast } from "sonner";

const fmt = (n = 0) => "\u20B9" + Math.round(n).toLocaleString("en-IN");
const fmtDec = (n = 0) => "\u20B9" + Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function CostSheet() {
  const { unitId } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const printRef = useRef(null);

  const [unit, setUnit] = useState(null);
  const [project, setProject] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [templateId, setTemplateId] = useState(params.get("template_id") || "");
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().slice(0, 10));
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [prospect, setProspect] = useState({ name: "", contact: "", email: "" });

  useEffect(() => {
    (async () => {
      try {
        const [u, tpls, projs] = await Promise.all([
          api.get("/units"),
          api.get("/payment-templates"),
          api.get("/projects"),
        ]);
        const found = u.data.find((x) => x.unit_id === unitId);
        if (!found) return toast.error("Unit not found");
        setUnit(found);
        setTemplates(tpls.data);
        if (!templateId) {
          setTemplateId(found.payment_plan_template_id || tpls.data[0]?.template_id || "");
        }
        setProject(projs.data.find((p) => p.project_id === found.project_id) || null);
      } catch (e) { toast.error(apiError(e)); }
      finally { setLoading(false); }
    })();
  }, [unitId]);

  useEffect(() => {
    if (!unit || !templateId) return;
    (async () => {
      try {
        const r = await api.get(`/units/${unitId}/preview-schedule`, {
          params: { template_id: templateId, booking_date: bookingDate },
        });
        setSchedule(r.data.schedule || []);
      } catch (e) { toast.error(apiError(e)); }
    })();
  }, [unit, templateId, bookingDate, unitId]);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.template_id === templateId) || null,
    [templateId, templates],
  );

  const scheduleTotal = useMemo(
    () => schedule.reduce((s, i) => s + (i.amount || 0), 0),
    [schedule],
  );

  const pricing = unit?.pricing;
  const gstRate = pricing?.gst_rate ?? 0.18;

  const costRows = useMemo(() => {
    if (!pricing) {
      return [{ label: "Total price", value: unit?.total_price || 0, muted: false, level: 0 }];
    }
    const rows = [
      { label: "Basic Sale Price (BSP)", value: pricing.bsp, level: 0 },
      { label: "PLC (Preferential Location Charges)", value: pricing.plc, level: 0, bold: true },
    ];
    Object.entries(pricing.plc_breakdown || {}).forEach(([k, v]) => {
      if (v)
        rows.push({ label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), value: v, level: 1, muted: true });
    });
    rows.push({ label: "Other Charges 1 — Infrastructure & Development", value: pricing.oc1, level: 0 });
    rows.push({ label: `GST @ ${Math.round(gstRate * 100)}% on OC1`, value: pricing.oc1 * gstRate, level: 1, muted: true });
    rows.push({ label: "Other Charges 2 — Legal + Club + 2-yr Maintenance", value: pricing.oc2, level: 0, bold: true });
    Object.entries(pricing.oc2_breakdown || {}).forEach(([k, v]) => {
      if (v)
        rows.push({ label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), value: v, level: 1, muted: true });
    });
    rows.push({ label: `GST @ ${Math.round(gstRate * 100)}% on OC2`, value: pricing.oc2 * gstRate, level: 1, muted: true });
    rows.push({ label: "IFMS — Interest Free Maintenance Security (refundable)", value: pricing.ifms, level: 0, note: "Refundable" });
    return rows;
  }, [pricing, gstRate, unit]);

  const handlePrint = () => window.print();

  const downloadPdf = () => {
    // Uses the browser's print-to-PDF (cross-platform, no dependency)
    window.print();
  };

  if (loading) {
    return <div className="p-12 text-center text-stone-500">Loading cost sheet…</div>;
  }
  if (!unit) {
    return <div className="p-12 text-center text-stone-500">Unit not found</div>;
  }

  return (
    <div className="min-h-screen bg-stone-50 print:bg-white" data-testid="cost-sheet-page">
      {/* Toolbar — hidden on print */}
      <div className="print:hidden border-b border-stone-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => nav(-1)} data-testid="back-btn">
              <ArrowLeft className="w-4 h-4 mr-1" /> Back
            </Button>
            <div className="text-sm text-stone-600">
              <span className="text-stone-400">Plot</span>{" "}
              <span className="font-semibold text-stone-900">{unit.plot_number}</span>{" "}
              <span className="text-stone-400 mx-2">·</span>{" "}
              <span>{project?.name || ""}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-xs uppercase tracking-widest text-stone-500">Plan</div>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="min-w-[240px]" data-testid="plan-select">
                <SelectValue placeholder="Select plan" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.template_id} value={t.template_id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs uppercase tracking-widest text-stone-500 ml-2">Booking date</div>
            <Input
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="w-40"
              data-testid="booking-date-input"
            />
            <Button variant="outline" size="sm" onClick={handlePrint} data-testid="print-btn">
              <Printer className="w-4 h-4 mr-1" /> Print
            </Button>
            <Button variant="outline" size="sm" onClick={downloadPdf} data-testid="pdf-btn">
              <Download className="w-4 h-4 mr-1" /> PDF
            </Button>
          </div>
        </div>
        {/* Prospect fields — printed on the sheet */}
        <div className="max-w-6xl mx-auto px-6 pb-3 flex items-center gap-3 flex-wrap text-xs">
          <span className="uppercase tracking-widest text-stone-500">Prepared for</span>
          <Input placeholder="Prospect name" value={prospect.name} onChange={(e) => setProspect({ ...prospect, name: e.target.value })} className="w-56" data-testid="prospect-name" />
          <Input placeholder="Phone" value={prospect.contact} onChange={(e) => setProspect({ ...prospect, contact: e.target.value })} className="w-40" data-testid="prospect-contact" />
          <Input placeholder="Email (optional)" value={prospect.email} onChange={(e) => setProspect({ ...prospect, email: e.target.value })} className="w-56" data-testid="prospect-email" />
        </div>
      </div>

      {/* Printable canvas */}
      <div ref={printRef} className="max-w-6xl mx-auto p-6 md:p-10 print:p-0">
        <div className="bg-white border border-stone-200 print:border-0 print:shadow-none rounded-xl p-8 md:p-10 shadow-sm">
          {/* Header */}
          <div className="flex items-start justify-between flex-wrap gap-4 border-b border-stone-200 pb-5">
            <div>
              <div className="text-[10px] uppercase tracking-[0.24em] text-emerald-800">Cost Sheet</div>
              <h1 className="text-2xl md:text-3xl font-bold text-stone-900 mt-1">
                {project?.name || "—"}
              </h1>
              <div className="text-sm text-stone-500 mt-1">
                {project?.location || ""}
                {project?.rera_number ? <> · RERA {project.rera_number}</> : null}
              </div>
            </div>
            <div className="text-right text-xs text-stone-500">
              <div>Ref: <span className="text-stone-800 font-mono">{unit.unit_id}</span></div>
              <div>Date: <span className="text-stone-800">{bookingDate}</span></div>
            </div>
          </div>

          {/* Prospect + unit summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">Prospect</div>
              <div className="text-lg font-semibold text-stone-900">
                {prospect.name || "—"}
              </div>
              <div className="text-sm text-stone-600">{prospect.contact || ""}</div>
              <div className="text-sm text-stone-600">{prospect.email || ""}</div>
            </div>
            <div className="md:text-right">
              <div className="text-[10px] uppercase tracking-widest text-stone-500 mb-1">Plot details</div>
              <div className="text-lg font-semibold text-stone-900">Plot {unit.plot_number}</div>
              <div className="text-sm text-stone-600">
                {unit.size || "—"}{unit.facing ? <> · {unit.facing}</> : null}
              </div>
              {(unit.plcs || []).length > 0 && (
                <div className="text-xs text-emerald-800 mt-1">
                  PLC: {(unit.plcs || []).map((p) => p.label).join(", ")}
                </div>
              )}
            </div>
          </div>

          {/* Two-column: cost breakdown | payment schedule */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mt-8">
            {/* Cost breakdown */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-bold text-stone-900 tracking-wide">
                  Cost Breakdown
                </h2>
                <div className="text-[10px] uppercase tracking-widest text-stone-500">Amount in INR</div>
              </div>
              <div className="border border-stone-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody className="divide-y divide-stone-100">
                    {costRows.map((r, i) => (
                      <tr key={i} className={r.muted ? "text-stone-500" : ""}>
                        <td className={`py-2 px-3 ${r.level ? "pl-8" : ""} ${r.bold ? "font-semibold" : ""}`}>
                          {r.label}
                          {r.note && <span className="ml-2 text-[10px] uppercase tracking-widest text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">{r.note}</span>}
                        </td>
                        <td className={`py-2 px-3 text-right tabular-nums ${r.bold ? "font-semibold" : ""}`}>
                          {r.value ? fmtDec(r.value) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-900 text-white">
                      <td className="py-3 px-3 font-bold text-sm uppercase tracking-widest">Grand Total</td>
                      <td className="py-3 px-3 text-right tabular-nums font-bold text-lg">
                        {fmtDec(pricing?.grand_total || unit.total_price || 0)}
                      </td>
                    </tr>
                    {pricing?.ifms > 0 && (
                      <tr className="bg-stone-50 text-xs">
                        <td className="py-2 px-3 text-stone-500">Payable (net of refundable IFMS)</td>
                        <td className="py-2 px-3 text-right tabular-nums text-stone-700">
                          {fmtDec((pricing.grand_total || 0) - pricing.ifms)}
                        </td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Payment schedule */}
            <div>
              <div className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-bold text-stone-900 tracking-wide">
                  Payment Schedule
                </h2>
                <div className="text-[10px] uppercase tracking-widest text-emerald-800">
                  {activeTemplate?.name || "—"}
                </div>
              </div>
              <div className="border border-stone-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-stone-50 text-[10px] uppercase tracking-widest text-stone-500">
                    <tr>
                      <th className="text-left py-2 px-3">Milestone</th>
                      <th className="text-left py-2 px-3">Due</th>
                      <th className="text-right py-2 px-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {schedule.map((s, i) => (
                      <tr key={i}>
                        <td className="py-2 px-3">
                          <div className="font-medium text-stone-900">{s.stage_name}</div>
                          {s.breakdown && (
                            <div className="text-[11px] text-stone-500 mt-0.5">
                              {[
                                s.breakdown.bsp ? `BSP ${fmt(s.breakdown.bsp)}` : null,
                                s.breakdown.plc ? `PLC ${fmt(s.breakdown.plc)}` : null,
                                s.breakdown.oc1 ? `OC1 ${fmt(s.breakdown.oc1)}${s.breakdown.gst_oc1 ? ` +GST ${fmt(s.breakdown.gst_oc1)}` : ""}` : null,
                                s.breakdown.oc2 ? `OC2 ${fmt(s.breakdown.oc2)}${s.breakdown.gst_oc2 ? ` +GST ${fmt(s.breakdown.gst_oc2)}` : ""}` : null,
                                s.breakdown.ifms ? `IFMS ${fmt(s.breakdown.ifms)}` : null,
                              ].filter(Boolean).join(" · ")}
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-3 text-stone-600 whitespace-nowrap">
                          {s.trigger === "notice_of_possession" ? (
                            <span className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">On Notice of Possession</span>
                          ) : (
                            <span className="tabular-nums">{s.due_date}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right tabular-nums font-medium">{fmt(s.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-emerald-900 text-white">
                      <td className="py-3 px-3 font-bold text-sm uppercase tracking-widest" colSpan={2}>Total Schedule</td>
                      <td className="py-3 px-3 text-right tabular-nums font-bold text-lg">{fmt(scheduleTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>

          {/* Footer notes */}
          <div className="mt-8 pt-6 border-t border-stone-200 text-[11px] text-stone-500 space-y-1">
            <div className="flex items-start gap-2">
              <FileText className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div>
                All charges are indicative and subject to change. GST is charged
                at prevailing rates ({Math.round(gstRate * 100)}% at the time of
                this sheet). IFMS is a refundable, non-interest-bearing security deposit
                held for 12 months of common-area maintenance.
              </div>
            </div>
            <div>Prices exclude Stamp Duty, Registration, and any statutory levies applicable at
              the time of registration, unless expressly included above.</div>
            <div className="text-stone-400 pt-2">
              Generated by Agrocorp Admin · Unit ref {unit.unit_id}
            </div>
          </div>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: #fff !important; }
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background: #fff !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:border-0 { border: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          @page { margin: 12mm; size: A4 portrait; }
          .max-w-6xl { max-width: 100% !important; }
        }
      `}</style>
    </div>
  );
}
