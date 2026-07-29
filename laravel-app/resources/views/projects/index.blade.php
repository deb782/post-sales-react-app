@extends('layouts.app')
@section('title', 'Projects')
@section('heading', 'Projects')
@section('header-actions')
    @if(auth()->user()->isAdmin())
        <button x-data @click="$dispatch('open-modal', 'create-project')" class="btn-primary">New project</button>
    @endif
@endsection

@section('content')
    @if($projects->isEmpty())
        <div class="card p-10 text-center text-slate-500">
            <p>No projects yet.</p>
            @if(auth()->user()->isAdmin())
                <p class="text-xs mt-2">Click <b>New project</b> to add your first one.</p>
            @endif
        </div>
    @else
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            @foreach($projects as $p)
                <div class="card overflow-hidden">
                    @if($p->image_path)
                        <img src="{{ Storage::disk('public')->url($p->image_path) }}" class="w-full h-40 object-cover">
                    @else
                        <div class="w-full h-40 bg-slate-100 flex items-center justify-center text-slate-400 text-xs uppercase tracking-wide">No cover</div>
                    @endif
                    <div class="p-5">
                        <div class="flex items-start justify-between">
                            <div>
                                <div class="text-lg font-semibold text-slate-900">{{ $p->name }}</div>
                                <div class="text-xs text-slate-500 mt-0.5">
                                    <span class="badge-slate">{{ str_replace('_', ' ', ucwords($p->project_type, '_')) }}</span>
                                    <span class="ml-1">{{ $p->city }}{{ $p->state ? ', '.$p->state : '' }}</span>
                                </div>
                            </div>
                            <div class="text-right text-xs text-slate-500">
                                <div>{{ $p->units_count }} units</div>
                                @if($p->target_revenue > 0)
                                    <div class="text-slate-400 mt-1">Target ₹{{ number_format($p->target_revenue) }}</div>
                                @endif
                            </div>
                        </div>
                        <div class="mt-4 flex items-center justify-between text-xs">
                            <a href="{{ route('units.index', ['project_id' => $p->id]) }}" class="text-brand-600 hover:underline">View units →</a>
                            @if(auth()->user()->isAdmin())
                                <form method="POST" action="{{ route('projects.destroy', $p) }}" onsubmit="return confirm('Delete “{{ $p->name }}” and all its data?')">
                                    @csrf @method('DELETE')
                                    <button class="text-red-600 hover:underline">Delete</button>
                                </form>
                            @endif
                        </div>
                    </div>
                </div>
            @endforeach
        </div>
    @endif

    @if(auth()->user()->isAdmin())
        @include('projects.partials.create-modal')
    @endif
@endsection
