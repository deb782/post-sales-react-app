@extends('layouts.app')
@section('title', 'Users')
@section('heading', 'Team & Access')
@section('header-actions')
    <button x-data @click="$dispatch('open-modal', 'invite-user')" class="btn-primary">Invite user</button>
@endsection

@section('content')
    <div class="card overflow-hidden">
        <table class="w-full">
            <thead class="bg-slate-50 border-b border-slate-200">
                <tr>
                    <th class="table-th">Name</th>
                    <th class="table-th">Email</th>
                    <th class="table-th">Role</th>
                    <th class="table-th">Projects</th>
                    <th class="table-th">Status</th>
                    <th class="table-th text-right pr-4">Actions</th>
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
                @foreach($users as $u)
                    <tr>
                        <td class="table-td font-medium text-slate-900">{{ $u->name }}</td>
                        <td class="table-td">{{ $u->email }}</td>
                        <td class="table-td">
                            <span class="badge-slate">{{ str_replace('_', ' ', ucwords($u->role, '_')) }}</span>
                            @if($u->must_reset_password)
                                <span class="badge-amber ml-1">Password reset pending</span>
                            @endif
                        </td>
                        <td class="table-td text-xs">{{ $u->projects()->pluck('name')->join(', ') ?: '—' }}</td>
                        <td class="table-td">
                            @if($u->is_active) <span class="badge-green">Active</span>
                            @else <span class="badge-red">Deactivated</span> @endif
                        </td>
                        <td class="table-td text-right pr-4">
                            <form method="POST" action="{{ route('users.reset', $u) }}" class="inline">
                                @csrf
                                <button class="text-xs text-brand-600 hover:underline">Reset pwd</button>
                            </form>
                            @if($u->is_active && $u->id !== auth()->id())
                                <form method="POST" action="{{ route('users.destroy', $u) }}" class="inline ml-2" onsubmit="return confirm('Deactivate {{ $u->name }}?')">
                                    @csrf @method('DELETE')
                                    <button class="text-xs text-red-600 hover:underline">Deactivate</button>
                                </form>
                            @endif
                        </td>
                    </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <div
        x-data="{ open: false }"
        x-on:open-modal.window="if ($event.detail === 'invite-user') open = true"
        x-on:keydown.escape.window="open = false"
        x-show="open" x-cloak
        class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
        <div class="card w-full max-w-md p-6" @click.outside="open = false">
            <div class="flex justify-between items-center mb-4">
                <h2 class="text-lg font-semibold">Invite user</h2>
                <button @click="open = false" class="text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <form method="POST" action="{{ route('users.store') }}" class="space-y-3">
                @csrf
                <div><label class="block text-xs font-medium mb-1">Email</label><input type="email" name="email" class="input" required></div>
                <div><label class="block text-xs font-medium mb-1">Name</label><input type="text" name="name" class="input" required></div>
                <div><label class="block text-xs font-medium mb-1">Phone</label><input type="text" name="phone" class="input"></div>
                <div>
                    <label class="block text-xs font-medium mb-1">Role</label>
                    <select name="role" class="input" required>
                        <option value="site_manager">Site Manager</option>
                        <option value="accounts">Accounts</option>
                        <option value="management">Management</option>
                        <option value="admin">Admin</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-medium mb-1">Assign projects (site managers)</label>
                    <select name="project_ids[]" multiple class="input h-24">
                        @foreach($projects as $p)
                            <option value="{{ $p->id }}">{{ $p->name }}</option>
                        @endforeach
                    </select>
                </div>
                <p class="text-xs text-slate-500">A temp password is auto-generated & emailed via Google Workspace SMTP.</p>
                <div class="flex justify-end gap-2 pt-2">
                    <button type="button" @click="open = false" class="btn-secondary">Cancel</button>
                    <button type="submit" class="btn-primary">Send invite</button>
                </div>
            </form>
        </div>
    </div>
@endsection
