{{-- Global search: ⌘K / Ctrl+K to open --}}
<div x-data="globalSearch()" @keydown.window.slash.prevent="open()" @keydown.window.meta.k.prevent="open()" @keydown.window.ctrl.k.prevent="open()">
    <button @click="open()" class="flex items-center gap-2 text-sm text-slate-500 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <span>Search</span>
        <kbd class="text-xs bg-white border border-slate-200 rounded px-1.5 py-0.5">⌘K</kbd>
    </button>

    <div x-show="isOpen" x-cloak @click.self="close()" @keydown.escape.window="close()"
         class="fixed inset-0 bg-black/40 flex items-start justify-center pt-20 px-4 z-50">
        <div class="card w-full max-w-lg overflow-hidden">
            <div class="p-2 border-b border-slate-100 flex items-center gap-2">
                <svg class="h-4 w-4 text-slate-400 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 10a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input x-ref="input" x-model="q" @input.debounce.200ms="run()"
                       placeholder="Search projects, units, expenses, users…"
                       class="w-full px-2 py-2 text-sm border-0 focus:outline-none focus:ring-0">
            </div>
            <div class="max-h-80 overflow-auto">
                <template x-for="r in results" :key="r.url + r.label">
                    <a :href="r.url" class="block p-3 hover:bg-slate-50 border-b border-slate-100 last:border-0">
                        <div class="flex items-center gap-2">
                            <span class="badge-slate uppercase" x-text="r.type"></span>
                            <span class="text-sm font-medium text-slate-900" x-text="r.label"></span>
                        </div>
                        <div class="text-xs text-slate-500 mt-1" x-text="r.meta"></div>
                    </a>
                </template>
                <template x-if="q.length >= 2 && results.length === 0 && !loading">
                    <div class="p-6 text-center text-slate-400 text-sm">No matches.</div>
                </template>
                <template x-if="q.length < 2">
                    <div class="p-6 text-center text-slate-400 text-sm">Type at least 2 characters.</div>
                </template>
            </div>
        </div>
    </div>
</div>

<script>
    function globalSearch() {
        return {
            isOpen: false, q: '', results: [], loading: false,
            open() { this.isOpen = true; this.$nextTick(() => this.$refs.input.focus()); },
            close() { this.isOpen = false; this.q = ''; this.results = []; },
            async run() {
                if (this.q.length < 2) { this.results = []; return; }
                this.loading = true;
                try {
                    const r = await fetch('{{ route('search') }}?q=' + encodeURIComponent(this.q), { credentials: 'same-origin' });
                    const d = await r.json();
                    this.results = d.results || [];
                } finally { this.loading = false; }
            }
        }
    }
</script>
