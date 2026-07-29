@extends('layouts.app')
@section('title', 'Units')
@section('heading', 'Inventory')

@section('header-actions')
    <form method="GET" class="flex items-center gap-2">
        <select name="project_id" onchange="this.form.submit()" class="input py-1.5 text-sm">
            @foreach($projects as $p)
                <option value="{{ $p->id }}" @selected($projectId === $p->id)>{{ $p->name }}</option>
            @endforeach
        </select>
        <select name="status" onchange="this.form.submit()" class="input py-1.5 text-sm">
            <option value="">All statuses</option>
            @foreach(['available', 'reserved', 'sold', 'cancelled'] as $s)
                <option value="{{ $s }}" @selected(request('status') === $s)>{{ ucfirst($s) }}</option>
            @endforeach
        </select>
    </form>
    @if(auth()->user()->hasRole('admin', 'accounts'))
        <button x-data @click="$dispatch('open-modal', 'add-unit')" class="btn-secondary">Add unit</button>
        @if(auth()->user()->isAdmin())
            <button x-data @click="$dispatch('open-modal', 'bulk-units')" class="btn-secondary">Bulk create</button>
            <button x-data @click="$dispatch('open-modal', 'import-units')" class="btn-secondary">Import Excel</button>
        @endif
    @endif
    <a href="{{ route('exports.units.xlsx', request()->only('project_id', 'status')) }}" class="btn-secondary">Excel</a>
    <a href="{{ route('exports.units.pdf', request()->only('project_id', 'status')) }}" class="btn-primary">PDF</a>
@endsection

@section('content')
    @if(! $projectId)
        <div class="card p-10 text-center text-slate-500">Create a project first.</div>
    @else
        <div class="card overflow-hidden">
            <table class="w-full">
                <thead class="bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th class="table-th">Unit #</th>
                        <th class="table-th">Price</th>
                        <th class="table-th">Status</th>
                        <th class="table-th">Buyer</th>
                        <th class="table-th text-right pr-4">Actions</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    @forelse($units as $u)
                        <tr>
                            <td class="table-td font-medium">{{ $u->unit_number }}</td>
                            <td class="table-td">₹{{ number_format($u->price) }}</td>
                            <td class="table-td">
                                @php
                                    $tone = ['available' => 'green', 'reserved' => 'amber', 'sold' => 'slate', 'cancelled' => 'red'][$u->status];
                                @endphp
                                <span class="badge-{{ $tone }}">{{ ucfirst($u->status) }}</span>
                            </td>
                            <td class="table-td text-xs text-slate-500">{{ $u->buyer_name ?: '—' }}</td>
                            <td class="table-td text-right pr-4 text-xs">
                                @if($u->status === 'available' && auth()->user()->hasRole('admin', 'accounts'))
                                    <button x-data @click="$dispatch('open-modal', {name: 'sell-unit', id: {{ $u->id }}, num: '{{ $u->unit_number }}', price: {{ $u->price }}})" class="text-brand-600 hover:underline">Sell</button>
                                @elseif($u->status === 'reserved' && auth()->user()->hasRole('admin', 'accounts'))
                                    <form method="POST" action="{{ route('units.release', $u) }}" class="inline">@csrf<button class="text-amber-600 hover:underline">Release</button></form>
                                @elseif($u->status === 'sold' && auth()->user()->isAdmin())
                                    <form method="POST" action="{{ route('units.cancel', $u) }}" class="inline" onsubmit="return confirm('Cancel sold unit?')">@csrf<button class="text-red-600 hover:underline">Cancel</button></form>
                                @endif
                            </td>
                        </tr>
                    @empty
                        <tr><td colspan="5" class="p-10 text-center text-slate-500 text-sm">No units for this filter.</td></tr>
                    @endforelse
                </tbody>
            </table>
        </div>

        @include('units.partials.modals', ['projectId' => $projectId])
    @endif
@endsection
