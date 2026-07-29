@extends('layouts.app')

@section('title', 'Dashboard')
@section('heading', 'Dashboard')

@section('content')
    <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <x-kpi-card label="Total Units" :value="$totalUnits" tone="slate"/>
        <x-kpi-card label="Sold" :value="$soldUnits" tone="green"/>
        <x-kpi-card label="Available" :value="$availableUnits" tone="amber"/>
        <x-kpi-card label="Pending Approvals" :value="$pendingApprovals" tone="red"/>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-6">
        <div class="card p-6 lg:col-span-2">
            <div class="text-sm font-semibold text-slate-700 mb-4">Revenue — last 12 months</div>
            <canvas id="revenueChart" height="110"></canvas>
        </div>
        <div class="card p-6">
            <div class="text-sm font-semibold text-slate-700 mb-4">Inventory status</div>
            <canvas id="inventoryChart" height="220"></canvas>
        </div>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <div class="card p-6">
            <div class="text-xs uppercase font-semibold text-slate-500">Accrued</div>
            <div class="text-2xl font-semibold text-slate-900 mt-1">
                {{ number_format($accrued, 0) }}
            </div>
            <div class="text-xs text-slate-500 mt-1">Sum of sold-unit prices</div>
        </div>
        <div class="card p-6">
            <div class="text-xs uppercase font-semibold text-slate-500">Received</div>
            <div class="text-2xl font-semibold text-emerald-700 mt-1">
                {{ number_format($received, 0) }}
            </div>
            <div class="text-xs text-slate-500 mt-1">Sum of recorded payments</div>
        </div>
        <div class="card p-6">
            <div class="text-xs uppercase font-semibold text-slate-500">Receivable</div>
            <div class="text-2xl font-semibold text-amber-700 mt-1">
                {{ number_format($receivable, 0) }}
            </div>
            <div class="text-xs text-slate-500 mt-1">Accrued − received</div>
        </div>
    </div>

    <script>
        window.addEventListener('DOMContentLoaded', () => {
            const revenueLabels = @json($monthlyRevenue->pluck('m'));
            const revenueTotals = @json($monthlyRevenue->pluck('total'));
            new Chart(document.getElementById('revenueChart'), {
                type: 'bar',
                data: {
                    labels: revenueLabels,
                    datasets: [{
                        label: 'Received',
                        data: revenueTotals,
                        backgroundColor: '#3d5afe',
                        borderRadius: 6,
                    }],
                },
                options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
            });

            const inv = @json($inventoryPie);
            new Chart(document.getElementById('inventoryChart'), {
                type: 'doughnut',
                data: {
                    labels: Object.keys(inv),
                    datasets: [{
                        data: Object.values(inv),
                        backgroundColor: ['#94a3b8', '#f59e0b', '#10b981', '#ef4444'],
                    }],
                },
                options: { plugins: { legend: { position: 'bottom' } } },
            });
        });
    </script>
@endsection
