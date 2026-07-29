<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\Unit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\View\View;

class UnitController extends Controller
{
    public function index(Request $request): View
    {
        $projects = $this->scopedProjects($request);
        $projectId = $request->integer('project_id') ?: $projects->first()?->id;

        $units = $projectId
            ? Unit::where('project_id', $projectId)
                ->when($request->filled('status'), fn($q) => $q->where('status', $request->status))
                ->orderBy('unit_number')->get()
            : collect();

        return view('units.index', compact('projects', 'projectId', 'units'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'unit_number' => ['required', 'string', 'max:60'],
            'price' => ['required', 'numeric', 'min:0'],
            'attributes' => ['nullable', 'array'],
        ]);
        Unit::create($data + ['status' => 'available']);
        return back()->with('status', 'Unit added.');
    }

    public function storeBulk(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'prefix' => ['required', 'string', 'max:20'],
            'start' => ['required', 'integer', 'min:0'],
            'end' => ['required', 'integer', 'min:0', 'gte:start'],
            'padding' => ['nullable', 'integer', 'min:0', 'max:6'],
            'base_price' => ['required', 'numeric', 'min:0'],
        ]);

        $range = $data['end'] - $data['start'] + 1;
        if ($range > 500) {
            return back()->withErrors(['end' => 'Cap of 500 units per bulk operation.']);
        }

        $padding = $data['padding'] ?? 0;
        $created = 0; $skipped = 0;

        DB::transaction(function () use ($data, $padding, &$created, &$skipped) {
            for ($n = $data['start']; $n <= $data['end']; $n++) {
                $suffix = $padding ? str_pad((string) $n, $padding, '0', STR_PAD_LEFT) : (string) $n;
                $number = $data['prefix'].$suffix;
                $exists = Unit::where('project_id', $data['project_id'])->where('unit_number', $number)->exists();
                if ($exists) { $skipped++; continue; }
                Unit::create([
                    'project_id' => $data['project_id'],
                    'unit_number' => $number,
                    'price' => $data['base_price'],
                    'status' => 'available',
                ]);
                $created++;
            }
        });

        return back()->with('status', "{$created} units created, {$skipped} skipped (already existed).");
    }

    public function sell(Request $request, Unit $unit): RedirectResponse
    {
        $data = $request->validate([
            'buyer_name' => ['required', 'string', 'max:120'],
            'buyer_contact' => ['nullable', 'string', 'max:80'],
            'price' => ['required', 'numeric', 'min:0'],
        ]);
        $unit->update($data + ['status' => 'sold', 'sold_at' => now()]);
        return back()->with('status', "{$unit->unit_number} marked sold.");
    }

    public function reserve(Request $request, Unit $unit): RedirectResponse
    {
        $data = $request->validate([
            'buyer_name' => ['required', 'string', 'max:120'],
            'buyer_contact' => ['nullable', 'string', 'max:80'],
            'reservation_expires_at' => ['required', 'date', 'after:today'],
        ]);
        $unit->update($data + ['status' => 'reserved']);
        return back()->with('status', "{$unit->unit_number} reserved.");
    }

    public function release(Unit $unit): RedirectResponse
    {
        $unit->update([
            'status' => 'available',
            'buyer_name' => null,
            'buyer_contact' => null,
            'reservation_expires_at' => null,
        ]);
        return back()->with('status', "{$unit->unit_number} released.");
    }

    public function cancel(Unit $unit): RedirectResponse
    {
        $unit->update(['status' => 'cancelled']);
        return back()->with('status', "{$unit->unit_number} cancelled.");
    }

    private function scopedProjects(Request $request)
    {
        $user = $request->user();
        return in_array($user->role, ['admin', 'accounts', 'management'], true)
            ? Project::orderBy('name')->get()
            : $user->projects()->orderBy('name')->get();
    }
}
