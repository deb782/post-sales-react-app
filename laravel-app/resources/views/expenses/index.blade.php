@extends('layouts.app')
@section('title', 'Expenses')
@section('heading', 'Expenses')
@section('header-actions')
    <form method="GET" class="flex items-center gap-2">
        <select name="status" onchange="this.form.submit()" class="input py-1.5 text-sm">
            <option value="">All</option>
            <option value="pending" @selected(request('status')==='pending')>Awaiting Stage 1</option>
            <option value="stage2" @selected(request('status')==='stage2')>Awaiting Final</option>
            <option value="approved" @selected(request('status')==='approved')>Approved</option>
            <option value="rejected" @selected(request('status')==='rejected')>Rejected</option>
        </select>
    </form>
    <button x-data @click="$dispatch('open-modal', 'raise-expense')" class="btn-primary">Raise expense</button>
@endsection

@section('content')
    <div class="card overflow-hidden">
        <table class="w-full">
            <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th class="table-th">Date</th>
                    <th class="table-th">Project</th>
                    <th class="table-th">Category / Vendor</th>
                    <th class="table-th">Amount</th>
                    <th class="table-th">Raised by</th>
                    <th class="table-th">Stage 1</th>
                    <th class="table-th">Final</th>
                    <th class="table-th text-right pr-4">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                @forelse($expenses as $e)
                    <tr>
                        <td class="table-td">{{ $e->expense_date->format('d M Y') }}</td>
                        <td class="table-td">{{ $e->project->name }}</td>
                        <td class="table-td">
                            <div class="font-medium">{{ $e->category }}</div>
                            <div class="text-xs text-slate-500">{{ $e->vendor }}</div>
                        </td>
                        <td class="table-td font-medium">
                            ₹{{ number_format($e->amount) }}
                            @if($e->amount > $threshold)<span class="badge-amber ml-1">Needs final</span>@endif
                        </td>
                        <td class="table-td text-xs">{{ $e->raiser->name ?? '—' }}</td>
                        <td class="table-td">
                            @php $tone = ['pending' => 'amber', 'approved' => 'green', 'rejected' => 'red'][$e->stage1_status]; @endphp
                            <span class="badge-{{ $tone }}">{{ ucfirst($e->stage1_status) }}</span>
                            @if($e->stage1_reason)<div class="text-xs text-red-600 mt-1">{{ $e->stage1_reason }}</div>@endif
                        </td>
                        <td class="table-td">
                            @php $tone = ['pending' => 'amber', 'approved' => 'green', 'rejected' => 'red', 'not_required' => 'slate'][$e->final_status]; @endphp
                            <span class="badge-{{ $tone }}">{{ str_replace('_',' ', ucfirst($e->final_status)) }}</span>
                            @if($e->final_reason)<div class="text-xs text-red-600 mt-1">{{ $e->final_reason }}</div>@endif
                        </td>
                        <td class="table-td text-right pr-4 text-xs">
                            @if($e->receipt_path)
                                <a href="{{ Storage::disk('public')->url($e->receipt_path) }}" target="_blank" class="text-slate-600 hover:underline mr-2">Receipt</a>
                            @endif
                            @if($e->stage1_status === 'pending' && auth()->user()->hasRole('accounts','admin'))
                                <button x-data @click="$dispatch('open-modal', {name: 'act-expense', id: {{ $e->id }}, stage: 1})" class="text-brand-600 hover:underline">Act</button>
                            @elseif($e->stage1_status === 'approved' && $e->final_status === 'pending' && auth()->user()->hasRole('management','admin'))
                                <button x-data @click="$dispatch('open-modal', {name: 'act-expense', id: {{ $e->id }}, stage: 2})" class="text-brand-600 hover:underline">Act</button>
                            @endif
                        </td>
                    </tr>
                @empty
                    <tr><td colspan="8" class="p-10 text-center text-slate-500 text-sm">No expenses to show.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>

    {{-- Raise-expense modal --}}
    <div x-data="{ open: false }" x-on:open-modal.window="if ($event.detail === 'raise-expense') open = true"
         x-show="open" x-cloak class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
        <div class="card w-full max-w-md p-6" @click.outside="open = false">
            <div class="flex justify-between items-center mb-4"><h2 class="text-lg font-semibold">Raise expense</h2><button @click="open=false" class="text-slate-400">✕</button></div>
            <form method="POST" action="{{ url('/expenses') }}" enctype="multipart/form-data" class="space-y-3">
                @csrf
                <div>
                    <label class="block text-xs mb-1">Project</label>
                    <select name="project_id" class="input" required>
                        @foreach($projects as $p)<option value="{{ $p->id }}">{{ $p->name }}</option>@endforeach
                    </select>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="block text-xs mb-1">Category</label><input name="category" class="input" required></div>
                    <div><label class="block text-xs mb-1">Vendor</label><input name="vendor" class="input"></div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div><label class="block text-xs mb-1">Amount (₹)</label><input type="number" step="0.01" name="amount" class="input" required></div>
                    <div><label class="block text-xs mb-1">Date</label><input type="date" name="expense_date" value="{{ now()->toDateString() }}" class="input" required></div>
                </div>
                <div><label class="block text-xs mb-1">Description</label><textarea name="description" rows="2" class="input"></textarea></div>
                <div><label class="block text-xs mb-1">Receipt (pdf/jpg/png)</label><input type="file" name="receipt" accept=".pdf,image/*" class="text-sm"></div>
                <p class="text-xs text-slate-500">Expenses above ₹{{ number_format($threshold) }} require Management final approval.</p>
                <div class="flex justify-end gap-2 pt-2"><button type="button" @click="open=false" class="btn-secondary">Cancel</button><button class="btn-primary">Raise</button></div>
            </form>
        </div>
    </div>

    {{-- Act-on-expense modal --}}
    <div x-data="{ open: false, id: null, stage: 1, decision: 'approved' }"
         x-on:open-modal.window="if ($event.detail.name === 'act-expense') { open = true; id = $event.detail.id; stage = $event.detail.stage; decision = 'approved' }"
         x-show="open" x-cloak class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
        <div class="card w-full max-w-md p-6" @click.outside="open = false">
            <h2 class="text-lg font-semibold mb-3">
                <span x-text="stage === 1 ? 'Stage-1 decision' : 'Final decision'"></span>
            </h2>
            <form :action="'/expenses/' + id + '/' + (stage === 1 ? 'stage1' : 'final')" method="POST" class="space-y-3">
                @csrf
                <div class="flex gap-2">
                    <label class="flex-1"><input type="radio" name="decision" value="approved" x-model="decision" class="mr-1"> Approve</label>
                    <label class="flex-1"><input type="radio" name="decision" value="rejected" x-model="decision" class="mr-1"> Reject</label>
                </div>
                <div x-show="decision === 'rejected'">
                    <label class="block text-xs mb-1">Reason (required)</label>
                    <textarea name="reason" rows="3" class="input"></textarea>
                </div>
                <div class="flex justify-end gap-2 pt-2"><button type="button" @click="open=false" class="btn-secondary">Cancel</button><button class="btn-primary">Submit</button></div>
            </form>
        </div>
    </div>
@endsection
