import { useEffect, useState } from "react";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { GripVertical, Settings2 } from "lucide-react";
import { api } from "@/lib/api";
import { toast } from "sonner";

// Widget catalogue — id must match render sections in Dashboard.
export const WIDGET_LIBRARY = [
  { id: "kpis",           label: "KPI Cards",           description: "Projects, Units Sold, Revenue, Pending Approvals" },
  { id: "variance",       label: "Revenue Variance",    description: "Month + Quarter target vs actual chips" },
  { id: "revenue_target", label: "Revenue vs Target",   description: "Progress bar + accrued/received/receivable" },
  { id: "inventory_bar",  label: "Inventory Status",    description: "Bar chart of sold/available/reserved" },
  { id: "expense_pie",    label: "Expenses by Status",  description: "Pie chart of expense workflow states" },
  { id: "expense_trend",  label: "Expense Trend (30d)", description: "Line chart of approved expenses" },
  { id: "vendors",        label: "Vendor Spend",        description: "Top 5 vendors with month-over-month delta" },
];

const DEFAULT_ORDER = WIDGET_LIBRARY.map(w => w.id);

export function useDashboardConfig() {
  const [order, setOrder] = useState(DEFAULT_ORDER);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api.get("/me/dashboard-config").then(({ data }) => {
      if (Array.isArray(data.widgets) && data.widgets.length > 0) setOrder(data.widgets);
    }).catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = async (next) => {
    setOrder(next);
    try {
      await api.patch("/me/dashboard-config", { widgets: next });
    } catch { toast.error("Failed to save layout"); }
  };

  return { order, save, loaded };
}

/**
 * Compact popover that lets a user toggle widgets on/off and drag to reorder.
 */
export default function DashboardCustomizer({ order, onChange }) {
  const [open, setOpen] = useState(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Merge library with saved order (library entries not in order = disabled)
  const items = [
    ...order.filter(id => WIDGET_LIBRARY.some(w => w.id === id))
           .map(id => WIDGET_LIBRARY.find(w => w.id === id)),
    ...WIDGET_LIBRARY.filter(w => !order.includes(w.id)),
  ];

  const toggle = (id) => {
    const next = order.includes(id) ? order.filter(x => x !== id) : [...order, id];
    onChange(next);
  };

  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return;
    // Only reorder within the enabled section
    const enabled = order.filter(id => WIDGET_LIBRARY.some(w => w.id === id));
    const oldIdx = enabled.indexOf(active.id);
    const newIdx = enabled.indexOf(over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onChange(arrayMove(enabled, oldIdx, newIdx));
  };

  const reset = () => onChange(DEFAULT_ORDER);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" data-testid="dashboard-customize-btn">
          <Settings2 className="w-4 h-4 mr-1" /> Customize
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="p-3 border-b border-stone-200 flex items-center justify-between">
          <div>
            <div className="font-semibold text-sm">Customize dashboard</div>
            <div className="text-[11px] text-stone-500">Drag to reorder · toggle to show/hide</div>
          </div>
          <button onClick={reset} className="text-xs text-emerald-700 hover:underline" data-testid="reset-widgets-btn">Reset</button>
        </div>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={items.map(w => w.id)} strategy={verticalListSortingStrategy}>
            <div className="max-h-[420px] overflow-y-auto p-2 space-y-1">
              {items.map(w => {
                const enabled = order.includes(w.id);
                return (
                  <WidgetRow
                    key={w.id}
                    widget={w}
                    enabled={enabled}
                    onToggle={() => toggle(w.id)}
                  />
                );
              })}
            </div>
          </SortableContext>
        </DndContext>
      </PopoverContent>
    </Popover>
  );
}

function WidgetRow({ widget, enabled, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id, disabled: !enabled });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}
         className={`flex items-center gap-2 p-2 rounded-md border ${enabled ? "border-stone-200 bg-white" : "border-dashed border-stone-200 bg-stone-50"}`}
         data-testid={`widget-row-${widget.id}`}>
      <button
        {...attributes} {...listeners}
        className={`text-stone-400 hover:text-stone-700 ${enabled ? "cursor-grab" : "cursor-not-allowed opacity-40"}`}
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${enabled ? "text-stone-900" : "text-stone-400"}`}>{widget.label}</div>
        <div className="text-[11px] text-stone-500 truncate">{widget.description}</div>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} data-testid={`widget-toggle-${widget.id}`} />
    </div>
  );
}
