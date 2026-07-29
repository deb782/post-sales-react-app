<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-50">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', config('app.name'))</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="h-full text-slate-800 antialiased">
    <div class="min-h-full flex">
        {{-- Sidebar --}}
        <aside class="w-60 bg-slate-900 text-slate-100 flex flex-col">
            <div class="px-5 py-5 border-b border-slate-800">
                <div class="text-lg font-semibold tracking-tight">{{ config('app.company_name') }}</div>
                <div class="text-xs text-slate-400">Estate Dashboard</div>
            </div>
            <nav class="flex-1 px-3 py-4 space-y-1 text-sm">
                @php
                    $items = [
                        ['dashboard',   'Dashboard',   ['admin','accounts','management','site_manager']],
                        ['projects.index',  'Projects',    ['admin','accounts','management','site_manager']],
                        ['units.index',     'Units',       ['admin','accounts','management','site_manager']],
                        ['revenue.index',   'Revenue',     ['admin','accounts','management']],
                        ['expenses.index',  'Expenses',    ['admin','accounts','management','site_manager']],
                        ['stock.index',     'Stock Book',  ['admin','site_manager']],
                        ['audit.index',     'Audit Log',   ['admin','accounts','management']],
                        ['users.index',     'Users',       ['admin']],
                        ['settings.index',  'Settings',    ['admin']],
                    ];
                @endphp
                @foreach ($items as [$route, $label, $roles])
                    @if (in_array(auth()->user()->role, $roles, true))
                        <a href="{{ route($route) }}"
                           class="block px-3 py-2 rounded-lg {{ request()->routeIs($route) ? 'bg-brand-600 text-white' : 'hover:bg-slate-800' }}">
                            {{ $label }}
                        </a>
                    @endif
                @endforeach
            </nav>
            <div class="px-4 py-3 border-t border-slate-800 text-sm">
                <div class="font-medium">{{ auth()->user()->name }}</div>
                <div class="text-xs text-slate-400">{{ str_replace('_', ' ', ucwords(auth()->user()->role, '_')) }}</div>
                <form method="POST" action="{{ route('logout') }}" class="mt-2">
                    @csrf
                    <button class="text-xs text-slate-400 hover:text-white">Log out</button>
                </form>
            </div>
        </aside>

        {{-- Main --}}
        <main class="flex-1 min-w-0">
            <header class="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between">
                <h1 class="text-xl font-semibold">@yield('heading', 'Dashboard')</h1>
                <div class="flex items-center gap-3">
                    @yield('header-actions')
                </div>
            </header>

            @if (session('status'))
                <div class="mx-8 mt-4 p-3 rounded-lg bg-emerald-50 text-emerald-700 text-sm">
                    {{ session('status') }}
                </div>
            @endif

            <div class="p-8">
                @yield('content')
            </div>
        </main>
    </div>
</body>
</html>
