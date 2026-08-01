import { useState } from "react";
import { Search } from "lucide-react";
import { api } from "@/lib/api";
import {
  Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export default function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState({ projects: [], units: [], expenses: [] });

  const runSearch = async (val) => {
    setQ(val);
    if (!val || val.length < 2) {
      setResults({ projects: [], units: [], expenses: [] });
      return;
    }
    const { data } = await api.get("/search", { params: { q: val } });
    setResults(data);
  };

  return (
    <>
      <button
        data-testid="global-search-trigger"
        onClick={() => setOpen(true)}
        className="w-full max-w-xl flex items-center gap-3 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm text-stone-500 hover:border-stone-300 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Search projects, units, expenses…</span>
        <span className="ml-auto text-[10px] uppercase tracking-widest text-stone-400">Ctrl K</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 max-w-2xl overflow-hidden">
          <DialogTitle className="sr-only">Global search</DialogTitle>
          <Command shouldFilter={false}>
            <CommandInput
              data-testid="global-search-input"
              value={q}
              onValueChange={runSearch}
              placeholder="Search…"
            />
            <CommandList>
              <CommandEmpty>Nothing found.</CommandEmpty>
              {results.projects.length > 0 && (
                <CommandGroup heading="Projects">
                  {results.projects.map((p) => (
                    <CommandItem key={p.project_id} onSelect={() => { setOpen(false); window.location.href = "/projects"; }}>
                      {p.name} <span className="ml-auto text-xs text-stone-500">{p.location}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.units.length > 0 && (
                <CommandGroup heading="Units">
                  {results.units.map((u) => (
                    <CommandItem key={u.unit_id} onSelect={() => { setOpen(false); window.location.href = "/units"; }}>
                      {u.plot_number} <span className="ml-auto text-xs text-stone-500">{u.status}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
              {results.expenses.length > 0 && (
                <CommandGroup heading="Expenses">
                  {results.expenses.map((e) => (
                    <CommandItem key={e.expense_id} onSelect={() => { setOpen(false); window.location.href = "/expenses"; }}>
                      {e.category} — ₹{e.amount.toLocaleString()} <span className="ml-auto text-xs text-stone-500">{e.vendor}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
