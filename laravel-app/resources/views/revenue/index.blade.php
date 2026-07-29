@extends('layouts.app')
@section('title', 'Revenue')
@section('heading', 'Revenue & Payments')

@section('header-actions')
    <form method="GET" class="flex items-center gap-2">
        <select name="project_id" onchange="this.form.submit()" class="input py-1.5 text-sm">
            <option value="">All projects</option>
            @foreach($projects as $p)
                <option value="{{ $p->id }}" @selected($projectId === $p->id)>{{ $p->name }}</option>
            @endforeach
        </select>
    </form>
    @if(auth()->user()->hasRole('admin', 'accounts'))
        <a href="{{ route('revenue.targets.index', ['project_id' => $projectId]) }}" class="btn-secondary">Targets</a>
        <button x-data @click="$dispatch('open-modal', 'record-payment')" class="btn-primary">Record payment</button>
    @endif
@endsection

@section('content')
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div class="card p-5"><div class="text-xs uppercase text-slate-500 font-semibold">Accrued</div><div class="text-2xl font-semibold mt-1">₹{{ number_format($accrued) }}</div></div>
        <div class="card p-5"><div class="text-xs uppercase text-slate-500 font-semibold">Received</div><div class="text-2xl font-semibold text-emerald-700 mt-1">₹{{ number_format($received) }}</div></div>
        <div class="card p-5"><div class="text-xs uppercase text-slate-500 font-semibold">Receivable</div><div class="text-2xl font-semibold text-amber-700 mt-1">₹{{ number_format($receivable) }}</div></div>
    </div>

    <div class="card overflow-hidden">
        <table class="w-full">
            <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th class="table-th">Date</th>
                    <th class="table-th">Unit</th>
                    <th class="table-th">Mode</th>
                    <th class="table-th">Amount</th>
                    <th class="table-th">Note</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                @forelse($payments as $p)
                    <tr>
                        <td class="table-td">{{ $p->paid_on->format('d M Y') }}</td>
                        <td class="table-td">{{ $p->unit->unit_number ?? '—' }}</td>
                        <td class="table-td"><span class="badge-slate uppercase">{{ $p->mode }}</span></td>
                        <td class="table-td font-medium">₹{{ number_format($p->amount) }}</td>
                        <td class="table-td text-xs text-slate-500">{{ $p->note }}</td>
                    </tr>
                @empty
                    <tr><td colspan="5" class="p-10 text-center text-slate-500 text-sm">No payments yet.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>

    @if(auth()->user()->hasRole('admin', 'accounts'))
        <div x-data="{ open: false }" x-on:open-modal.window="if ($event.detail === 'record-payment') open = true"
             x-show="open" x-cloak class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
            <div class="card w-full max-w-md p-6" @click.outside="open = false">
                <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-semibold">Record payment</h2><button @click="open=false" class="text-slate-400">✕</button></div>
                <form method="POST" action="{{ route('payments.store') }}" class="space-y-3">
                    @csrf
                    <div>
                        <label class="block text-xs mb-1">Unit</label>
                        <select name="unit_id" class="input" required>
                            <option value="">— select —</option>
                            @foreach(\App\Models\Unit::where('status', 'sold')->orderBy('unit_number')->get() as $u)
                                <option value="{{ $u->id }}">{{ $u->unit_number }} ({{ optional($u->project)->name }})</option>
                            @endforeach
                        </select>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div><label class="block text-xs mb-1">Amount (₹)</label><input type="number" step="0.01" name="amount" class="input" required></div>
                        <div><label class="block text-xs mb-1">Mode</label>
                            <select name="mode" class="input"><option value="bank">Bank</option><option value="cash">Cash</option><option value="upi">UPI</option><option value="cheque">Cheque</option></select>
                        </div>
                    </div>
                    <div><label class="block text-xs mb-1">Paid on</label><input type="date" name="paid_on" value="{{ now()->toDateString() }}" class="input" required></div>
                    <div><label class="block text-xs mb-1">Note</label><input name="note" class="input"></div>
                    <div class="flex justify-end gap-2 pt-2"><button type="button" @click="open=false" class="btn-secondary">Cancel</button><button class="btn-primary">Record</button></div>
                </form>
            </div>
        </div>
    @endif
@endsection
