<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-50">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="csrf-token" content="{{ csrf_token() }}">
    <title>@yield('title', config('app.name'))</title>

    {{-- Tailwind CSS via CDN (Play CDN — no build step) --}}
    <script src="https://cdn.tailwindcss.com?plugins=forms"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        brand: {
                            50: '#f5f7fb', 100: '#e8edf7',
                            500: '#3d5afe', 600: '#2f47d1',
                            700: '#2337a3', 900: '#141e5a',
                        }
                    }
                }
            }
        }
    </script>

    {{-- Alpine.js (for modals, dropdowns, search) --}}
    <script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/cdn.min.js"></script>

    {{-- Chart.js (for dashboard charts) --}}
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"></script>

    <style type="text/tailwindcss">
        @layer components {
            .btn { @apply inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition; }
            .btn-primary { @apply btn bg-brand-600 text-white hover:bg-brand-700; }
            .btn-secondary { @apply btn bg-white border border-slate-300 text-slate-700 hover:bg-slate-50; }
            .btn-danger { @apply btn bg-red-600 text-white hover:bg-red-700; }
            .input { @apply w-full rounded-lg border-slate-300 focus:border-brand-500 focus:ring-brand-500 text-sm; }
            .card { @apply bg-white rounded-xl border border-slate-200 shadow-sm; }
            .badge { @apply inline-flex items-center px-2 py-0.5 rounded text-xs font-medium; }
            .badge-green { @apply badge bg-emerald-50 text-emerald-700; }
            .badge-amber { @apply badge bg-amber-50 text-amber-700; }
            .badge-red { @apply badge bg-red-50 text-red-700; }
            .badge-slate { @apply badge bg-slate-100 text-slate-700; }
            .table-th { @apply px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide; }
            .table-td { @apply px-4 py-3 text-sm text-slate-700; }
        }
        [x-cloak] { display: none !important; }
    </style>
</head>
<body class="h-full text-slate-800 antialiased">
    <div class="min-h-full flex">
        {{-- Sidebar --}}
        <aside class="w-60 bg-slate-900 text-slate-100 flex flex-col">
            <div class="px-5 py-5 border-b border-slate-800">
                <div class="text-lg font-semibold tracking-tight">{{ config('app.company_name', config('app.name')) }}</div>
                <div class="text-xs text-slate-400">Estate Dashboard</div>
            </div>
            <nav class="flex-1 px-3 py-4 space-y-1 text-sm">
                @php
                    $items = [
                        ['dashboard',        'Dashboard',   ['admin','accounts','management','site_manager']],
                        ['projects.index',   'Projects',    ['admin','accounts','management','site_manager']],
                        ['units.index',      'Units',       ['admin','accounts','management','site_manager']],
                        ['revenue.index',    'Revenue',     ['admin','accounts','management']],
                        ['expenses.index',   'Expenses',    ['admin','accounts','management','site_manager']],
                        ['stock.index',      'Stock Book',  ['admin','site_manager']],
                        ['audit.index',      'Audit Log',   ['admin','accounts','management']],
                        ['users.index',      'Users',       ['admin']],
                        ['settings.index',   'Settings',    ['admin']],
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
                    @include('partials.search')
                    @include('partials.notifications-bell')
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
