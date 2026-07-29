@extends('layouts.app')
@section('title', 'Stock Book')
@section('heading', 'Stock Book')
@section('header-actions')
    <form method="GET" class="flex items-center gap-2">
        <select name="project_id" onchange="this.form.submit()" class="input py-1.5 text-sm">
            @foreach($projects as $p)
                <option value="{{ $p->id }}" @selected($projectId === $p->id)>{{ $p->name }}</option>
            @endforeach
        </select>
    </form>
    <button x-data @click="$dispatch('open-modal', 'add-item')" class="btn-secondary">Add item</button>
    <button x-data @click="$dispatch('open-modal', 'add-movement')" class="btn-primary">Record movement</button>
@endsection

@section('content')
    @if(! $projectId)
        <div class="card p-10 text-center text-slate-500">No project available.</div>
    @else
        <div class="card overflow-hidden">
            <table class="w-full">
                <thead class="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th class="table-th">Item</th>
                        <th class="table-th">Unit</th>
                        <th class="table-th">Opening</th>
                        <th class="table-th">Inward</th>
                        <th class="table-th">Outward</th>
                        <th class="table-th">Closing</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    @forelse($items as $it)
                        <tr>
                            <td class="table-td font-medium">{{ $it->name }}</td>
                            <td class="table-td">{{ $it->unit }}</td>
                            <td class="table-td">{{ number_format($it->opening, 2) }}</td>
                            <td class="table-td text-emerald-700">+{{ number_format($it->inwardTotal(), 2) }}</td>
                            <td class="table-td text-red-700">−{{ number_format($it->outwardTotal(), 2) }}</td>
                            <td class="table-td font-semibold">{{ number_format($it->closing(), 2) }}</td>
                        </tr>
                    @empty
                        <tr><td colspan="6" class="p-10 text-center text-slate-500 text-sm">No stock items yet.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        {{-- Add item modal --}}
        <div x-data="{ open: false }" x-on:open-modal.window="if ($event.detail === 'add-item') open = true"
             x-show="open" x-cloak class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div class="card w-full max-w-md p-6" @click.outside="open = false">
                <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-semibold">Add stock item</h2><button @click="open=false" class="text-slate-400">✕</button></div>
                <form method="POST" action="{{ route('stock.items.store') }}" class="space-y-3">
                    @csrf
                    <input type="hidden" name="project_id" value="{{ $projectId }}">
                    <div><label class="block text-xs mb-1">Name</label><input name="name" class="input" required></div>
                    <div class="grid grid-cols-2 gap-3">
                        <div><label class="block text-xs mb-1">Unit</label><input name="unit" placeholder="bag, ton, piece…" class="input" required></div>
                        <div><label class="block text-xs mb-1">Opening qty</label><input type="number" step="0.01" name="opening" value="0" class="input" required></div>
                    </div>
                    <div class="flex justify-end gap-2 pt-2"><button type="button" @click="open=false" class="btn-secondary">Cancel</button><button class="btn-primary">Add</button></div>
                </form>
            </div>
        </div>

        {{-- Add movement modal --}}
        <div x-data="{ open: false }" x-on:open-modal.window="if ($event.detail === 'add-movement') open = true"
             x-show="open" x-cloak class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div class="card w-full max-w-md p-6" @click.outside="open = false">
                <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-semibold">Record movement</h2><button @click="open=false" class="text-slate-400">✕</button></div>
                <form method="POST" action="{{ route('stock.movements.store') }}" class="space-y-3">
                    @csrf
                    <div>
                        <label class="block text-xs mb-1">Item</label>
                        <select name="stock_item_id" class="input" required>
                            @foreach($items as $it)<option value="{{ $it->id }}">{{ $it->name }} ({{ $it->unit }})</option>@endforeach
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div><label class="block text-xs mb-1">Kind</label>
                            <select name="kind" class="input"><option value="inward">Inward</option><option value="outward">Outward</option></select>
                        </div>
                        <div><label class="block text-xs mb-1">Quantity</label><input type="number" step="0.01" name="quantity" class="input" required></div>
                    </div>
                    <div><label class="block text-xs mb-1">Moved on</label><input type="date" name="moved_on" value="{{ now()->toDateString() }}" class="input" required></div>
                    <div><label class="block text-xs mb-1">Note</label><input name="note" class="input"></div>
                    <div class="flex justify-end gap-2 pt-2"><button type="button" @click="open=false" class="btn-secondary">Cancel</button><button class="btn-primary">Record</button></div>
                </form>
            </div>
        </div>
    @endif
@endsection
