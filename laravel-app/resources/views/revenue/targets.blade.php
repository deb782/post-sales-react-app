@extends('layouts.app')
@section('title', 'Revenue Targets')
@section('heading', 'Revenue Targets & Variance')
@section('header-actions')
    <a href="{{ route('revenue.index') }}" class="btn-secondary">← Back to Revenue</a>
    <button x-data @click="$dispatch('open-modal', 'add-target')" class="btn-primary">Add target</button>
@endsection

@section('content')
    <form method="GET" class="mb-4 flex items-center gap-2">
        <select name="project_id" onchange="this.form.submit()" class="input py-1.5 text-sm">
            @foreach($projects as $p)
                <option value="{{ $p->id }}" @selected($projectId === $p->id)>{{ $p->name }}</option>
            @endforeach
        </select>
    </form>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        @forelse($variances as $v)
            <div class="card p-5">
                <div class="flex items-start justify-between">
                    <div>
                        <div class="text-xs uppercase text-slate-500 font-semibold">{{ ucfirst($v['target']->period_type) }} · {{ $v['target']->period_key }}</div>
                        <div class="text-2xl font-semibold mt-1">₹{{ number_format($v['target']->amount) }}</div>
                    </div>
                    <span class="badge-{{ $v['tone'] }}">{{ $v['pct'] }}%</span>
                </div>
                <div class="mt-3 text-sm text-slate-600">
                    Actual: <b>₹{{ number_format($v['actual']) }}</b>
                    <div class="text-xs text-slate-400 mt-1">
                        Δ ₹{{ number_format($v['actual'] - (float)$v['target']->amount) }}
                    </div>
                </div>
                <form method="POST" action="{{ route('revenue.targets.destroy', $v['target']) }}" class="mt-3 text-right" onsubmit="return confirm('Remove target?')">
                    @csrf @method('DELETE')
                    <button class="text-xs text-red-600 hover:underline">Remove</button>
                </form>
            </div>
        @empty
            <div class="card p-10 text-center text-slate-500 md:col-span-3">No targets set. Add one above.</div>
        @endforelse
    </div>

    <div x-data="{ open: false }" x-on:open-modal.window="if ($event.detail === 'add-target') open = true"
         x-show="open" x-cloak class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
        <div class="card w-full max-w-md p-6" @click.outside="open = false">
            <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-semibold">Add revenue target</h2><button @click="open=false" class="text-slate-400">✕</button></div>
            <form method="POST" action="{{ route('revenue.targets.store') }}" class="space-y-3">
                @csrf
                <input type="hidden" name="project_id" value="{{ $projectId }}">
                <div>
                    <label class="block text-xs mb-1">Period type</label>
                    <select name="period_type" class="input"><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select>
                </div>
                <div><label class="block text-xs mb-1">Period key (e.g. 2026-02 or 2026-Q1)</label><input name="period_key" class="input" required></div>
                <div><label class="block text-xs mb-1">Amount (₹)</label><input type="number" step="0.01" name="amount" class="input" required></div>
                <div class="flex justify-end gap-2 pt-2"><button type="button" @click="open=false" class="btn-secondary">Cancel</button><button class="btn-primary">Save</button></div>
            </form>
        </div>
    </div>
@endsection
