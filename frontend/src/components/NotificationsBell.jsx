import { useEffect, useState } from "react";
import { Bell, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { api } from "@/lib/api";

export default function NotificationsBell() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get("/notifications");
      setItems(data);
    } catch (_e) { /* ignore */ }
  };
  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  const unread = items.filter(i => !i.is_read).length;

  const readAll = async () => {
    await api.post("/notifications/read-all");
    load();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          data-testid="notifications-bell"
          className="relative p-2 rounded-md hover:bg-stone-100 transition-colors"
        >
          <Bell className="w-5 h-5 text-stone-700" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
              {unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b border-stone-200">
          <div className="font-semibold text-sm">Notifications</div>
          <button
            onClick={readAll}
            data-testid="mark-all-read-btn"
            className="text-xs text-emerald-700 hover:underline flex items-center gap-1"
          >
            <Check className="w-3 h-3" /> Mark all read
          </button>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {items.length === 0 && (
            <div className="p-6 text-center text-sm text-stone-500">No notifications yet</div>
          )}
          {items.map((n) => (
            <div key={n.notification_id}
                 className={`px-3 py-2.5 border-b border-stone-100 text-sm ${n.is_read ? "text-stone-500" : "text-stone-900 bg-emerald-50/40"}`}>
              <div>{n.message}</div>
              <div className="text-[11px] text-stone-400 mt-0.5">
                {new Date(n.created_at).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
