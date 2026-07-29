{{-- Notifications bell (polls /api/notifications every 30s) --}}
<div x-data="notificationsBell()" x-init="poll(); setInterval(poll, 30000)" class="relative">
    <button @click="open = !open" class="relative p-2 rounded-lg hover:bg-slate-100">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        <span x-show="unread > 0" x-text="unread" x-cloak
              class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs rounded-full h-4 min-w-4 px-1 flex items-center justify-center"></span>
    </button>
    <div x-show="open" x-cloak @click.outside="open = false"
         class="absolute right-0 mt-2 w-80 card p-2 max-h-96 overflow-auto z-30">
        <div class="flex justify-between items-center px-2 pb-2 border-b border-slate-100">
            <div class="text-xs font-semibold text-slate-500 uppercase">Notifications</div>
            <form method="POST" action="{{ route('notifications.readAll') }}">
                @csrf
                <button class="text-xs text-brand-600 hover:underline">Mark all read</button>
            </form>
        </div>
        <template x-for="n in items" :key="n.id">
            <div class="p-2 border-b border-slate-100 last:border-0" :class="n.is_read ? 'opacity-60' : ''">
                <div class="text-sm text-slate-700" x-text="n.message"></div>
                <div class="text-xs text-slate-400 mt-1" x-text="new Date(n.created_at).toLocaleString()"></div>
            </div>
        </template>
        <template x-if="items.length === 0">
            <div class="p-6 text-center text-slate-400 text-sm">You're all caught up.</div>
        </template>
    </div>
</div>

<script>
    function notificationsBell() {
        return {
            open: false,
            items: [],
            unread: 0,
            async poll() {
                try {
                    const r = await fetch('{{ route('notifications.poll') }}', { credentials: 'same-origin' });
                    if (! r.ok) return;
                    const d = await r.json();
                    this.items = d.items;
                    this.unread = d.unread;
                } catch (e) {}
            }
        }
    }
</script>
