@extends('layouts.app')
@section('title', 'Audit Log')
@section('heading', 'Audit Log')
@section('header-actions')
    <form method="GET" class="flex items-center gap-2">
        <input name="action" value="{{ request('action') }}" placeholder="Action starts with…" class="input py-1.5 text-sm">
        <select name="entity_type" onchange="this.form.submit()" class="input py-1.5 text-sm">
            <option value="">All entities</option>
            @foreach(['user', 'project', 'unit', 'expense', 'payment'] as $t)
                <option value="{{ $t }}" @selected(request('entity_type') === $t)>{{ ucfirst($t) }}</option>
            @endforeach
        </select>
        <button class="btn-secondary">Filter</button>
    </form>
@endsection

@section('content')
    <div class="card overflow-hidden">
        <table class="w-full">
            <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th class="table-th">When</th>
                    <th class="table-th">Actor</th>
                    <th class="table-th">Action</th>
                    <th class="table-th">Entity</th>
                    <th class="table-th">Meta</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                @forelse($logs as $l)
                    <tr>
                        <td class="table-td">{{ $l->created_at->format('d M Y H:i') }}</td>
                        <td class="table-td">
                            <div>{{ $l->actor->name ?? '—' }}</div>
                            <div class="text-xs text-slate-500">{{ $l->actor_role }}</div>
                        </td>
                        <td class="table-td font-mono text-xs">{{ $l->action }}</td>
                        <td class="table-td text-xs">{{ $l->entity_type }} #{{ $l->entity_id }}</td>
                        <td class="table-td text-xs text-slate-500 max-w-md truncate">{{ $l->meta ? json_encode($l->meta) : '—' }}</td>
                    </tr>
                @empty
                    <tr><td colspan="5" class="p-10 text-center text-slate-500 text-sm">No entries.</td></tr>
                @endforelse
            </tbody>
        </table>
    </div>
@endsection
