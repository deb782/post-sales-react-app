@extends('layouts.app')
@section('title', 'Get started')
@section('heading', 'Welcome — let\'s set up')

@section('content')
    <div class="max-w-3xl mx-auto">
        {{-- Step indicator --}}
        <div class="flex items-center justify-between mb-8">
            @foreach ([1 => 'Project', 2 => 'Inventory', 3 => 'Team'] as $i => $label)
                <div class="flex-1 flex items-center gap-3">
                    <div class="h-8 w-8 rounded-full flex items-center justify-center text-sm font-semibold {{ $step >= $i ? 'bg-brand-600 text-white' : 'bg-slate-200 text-slate-600' }}">{{ $i }}</div>
                    <div class="text-sm font-medium {{ $step >= $i ? 'text-slate-900' : 'text-slate-500' }}">{{ $label }}</div>
                    @if ($i < 3)<div class="flex-1 h-px bg-slate-200"></div>@endif
                </div>
            @endforeach
        </div>

        @if ($step === 1)
            <div class="card p-6">
                <h2 class="text-lg font-semibold mb-1">Create your first project</h2>
                <p class="text-sm text-slate-500 mb-4">You can add more later. Site managers, units and expenses all belong to a project.</p>

                @if ($projects->isEmpty())
                    @include('projects.partials.create-modal')
                    <button x-data @click="$dispatch('open-modal', 'create-project')" class="btn-primary">Create project</button>
                @else
                    <div class="text-sm text-emerald-700 mb-4">✓ You have {{ $projects->count() }} project(s).</div>
                    <a href="{{ route('onboarding.index', ['step' => 2]) }}" class="btn-primary">Continue →</a>
                @endif
            </div>
        @elseif ($step === 2)
            <div class="card p-6">
                <h2 class="text-lg font-semibold mb-1">Add inventory</h2>
                <p class="text-sm text-slate-500 mb-4">You can bulk-create units with a pattern (e.g. <code>A-101</code> to <code>A-125</code>), or skip and do it later from the Units page.</p>
                <div class="flex gap-2">
                    <a href="{{ route('units.index', ['project_id' => $projects->first()?->id]) }}" class="btn-primary">Go to Units</a>
                    <a href="{{ route('onboarding.index', ['step' => 3]) }}" class="btn-secondary">Skip for now →</a>
                </div>
            </div>
        @else
            <div class="card p-6">
                <h2 class="text-lg font-semibold mb-1">Invite your team</h2>
                <p class="text-sm text-slate-500 mb-4">Recommended roles: at least one <b>Accounts</b>, one <b>Management</b>, and one <b>Site Manager</b>.</p>
                <div class="text-sm mb-4">
                    Team invited so far: <b>{{ $teamCount }}</b>
                </div>
                <div class="flex gap-2">
                    <a href="{{ route('users.index') }}" class="btn-secondary">Invite users</a>
                    <form method="POST" action="{{ route('onboarding.complete') }}">
                        @csrf
                        <button class="btn-primary">Finish onboarding</button>
                    </form>
                </div>
            </div>
        @endif
    </div>
@endsection
