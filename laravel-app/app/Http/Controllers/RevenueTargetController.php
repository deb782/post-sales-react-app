<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Project;
use App\Models\RevenueTarget;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class RevenueTargetController extends Controller
{
    public function index(Request $request): View
    {
        $projects = Project::orderBy('name')->get();
        $projectId = $request->integer('project_id') ?: $projects->first()?->id;

        $targets = $projectId
            ? RevenueTarget::where('project_id', $projectId)->orderBy('period_key', 'desc')->get()
            : collect();

        // Compute variance per target
        $variances = $targets->map(function ($t) {
            $range = $this->rangeFromKey($t->period_type, $t->period_key);
            $actual = (float) Payment::where('project_id', $t->project_id)
                ->whereBetween('paid_on', $range)->sum('amount');
            $pct = $t->amount > 0 ? round(($actual / (float) $t->amount) * 100, 1) : 0;
            return [
                'target' => $t,
                'actual' => $actual,
                'pct' => $pct,
                'tone' => $pct >= 100 ? 'green' : ($pct >= 80 ? 'amber' : 'red'),
            ];
        });

        return view('revenue.targets', compact('projects', 'projectId', 'variances'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'period_type' => ['required', 'in:monthly,quarterly'],
            'period_key' => ['required', 'string', 'max:10'],
            'amount' => ['required', 'numeric', 'min:0'],
        ]);
        RevenueTarget::updateOrCreate(
            ['project_id' => $data['project_id'], 'period_type' => $data['period_type'], 'period_key' => $data['period_key']],
            ['amount' => $data['amount']],
        );
        return back()->with('status', 'Target saved.');
    }

    public function destroy(RevenueTarget $target): RedirectResponse
    {
        $target->delete();
        return back()->with('status', 'Target removed.');
    }

    private function rangeFromKey(string $type, string $key): array
    {
        if ($type === 'monthly') {
            [$y, $m] = array_pad(explode('-', $key), 2, 1);
            $start = now()->create((int) $y, (int) $m, 1)->startOfMonth();
            return [$start->toDateString(), $start->copy()->endOfMonth()->toDateString()];
        }
        // quarterly like 2026-Q1
        [$y, $q] = explode('-Q', $key);
        $month = (((int) $q) - 1) * 3 + 1;
        $start = now()->create((int) $y, $month, 1)->startOfMonth();
        return [$start->toDateString(), $start->copy()->addMonths(3)->subDay()->toDateString()];
    }
}
