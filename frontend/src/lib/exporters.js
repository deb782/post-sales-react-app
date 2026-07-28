import { API_BASE } from "@/lib/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { toast } from "sonner";

/**
 * Download an .xlsx file exported by the backend.
 * @param {string} path e.g. "/exports/units"
 * @param {object} params query params (optional)
 * @param {string} filename local save name
 */
export async function downloadExcel(path, params = {}, filename = "export.xlsx") {
  const token = localStorage.getItem("session_token") || "";
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
  });
  try {
    const r = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (!r.ok) throw new Error(await r.text());
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  } catch (e) {
    toast.error("Excel export failed");
    console.error(e);
  }
}

/**
 * Client-side PDF export of a tabular dataset.
 * @param {string} title  page heading
 * @param {string[]} headers column headers
 * @param {any[][]} rows data rows
 * @param {string} filename save name
 */
export function downloadPdf(title, headers, rows, filename = "export.pdf") {
  try {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text(title, 40, 40);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(`Generated ${new Date().toLocaleString()}`, 40, 58);
    autoTable(doc, {
      startY: 74,
      head: [headers],
      body: rows,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [6, 78, 59], textColor: 255 },
      alternateRowStyles: { fillColor: [250, 250, 249] },
      margin: { left: 40, right: 40 },
    });
    doc.save(filename);
  } catch (e) {
    toast.error("PDF export failed");
    console.error(e);
  }
}
