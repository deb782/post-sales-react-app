<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\Payment;
use App\Models\Project;
use App\Models\Unit;
use Illuminate\Http\Request;
use Illuminate\View\View;

class DashboardController extends Controller
{
    public function index(Request $request): View
    {
        $user = $request->user();

        // Site managers see only their assigned projects
        $projectScope = $user->isAdmin() || in_array($user->role, ['accounts', 'management'], true)
            ? Project::query()
            : $user->projects()->getQuery();

        $projectIds = $projectScope->pluck('projects.id');

        $totalUnits = Unit::whereIn('project_id', $projectIds)->count();
        $soldUnits = Unit::whereIn('project_id', $projectIds)->where('status', 'sold')->count();
        $availableUnits = Unit::whereIn('project_id', $projectIds)->where('status', 'available')->count();
        $reservedUnits = Unit::whereIn('project_id', $projectIds)->where('status', 'reserved')->count();

        $received = (float) Payment::whereIn('project_id', $projectIds)->sum('amount');
        $accrued = (float) Unit::whereIn('project_id', $projectIds)->where('status', 'sold')->sum('price');
        $receivable = max($accrued - $received, 0);

        $pendingApprovals = Expense::whereIn('project_id', $projectIds)
            ->when($user->hasRole('accounts'), fn($q) => $q->where('stage1_status', 'pending'))
            ->when($user->hasRole('management'), fn($q) => $q->where('stage1_status', 'approved')->where('final_status', 'pending'))
            ->count();

        $monthlyRevenue = Payment::whereIn('project_id', $projectIds)
            ->where('paid_on', '>=', now()->subMonths(11)->startOfMonth())
            ->selectRaw("DATE_FORMAT(paid_on, '%Y-%m') as m, SUM(amount) as total")
            ->groupBy('m')->orderBy('m')->get();

        $inventoryPie = Unit::whereIn('project_id', $projectIds)
            ->selectRaw('status, COUNT(*) as n')->groupBy('status')->pluck('n', 'status');

        return view('dashboard', compact(
            'totalUnits', 'soldUnits', 'availableUnits', 'reservedUnits',
            'received', 'accrued', 'receivable', 'pendingApprovals',
            'monthlyRevenue', 'inventoryPie',
        ));
    }
}
