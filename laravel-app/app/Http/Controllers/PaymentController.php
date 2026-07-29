<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\Project;
use App\Models\Unit;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class PaymentController extends Controller
{
    public function index(Request $request): View
    {
        $projects = Project::orderBy('name')->get();
        $projectId = $request->integer('project_id');

        $payments = Payment::with('unit')
            ->when($projectId, fn($q) => $q->where('project_id', $projectId))
            ->orderBy('paid_on', 'desc')->limit(200)->get();

        $accrued = (float) Unit::when($projectId, fn($q) => $q->where('project_id', $projectId))
            ->where('status', 'sold')->sum('price');
        $received = (float) Payment::when($projectId, fn($q) => $q->where('project_id', $projectId))->sum('amount');
        $receivable = max($accrued - $received, 0);

        return view('revenue.index', compact('projects', 'projectId', 'payments', 'accrued', 'received', 'receivable'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'unit_id' => ['required', 'exists:units,id'],
            'amount' => ['required', 'numeric', 'min:0'],
            'mode' => ['required', 'in:bank,cash,upi,cheque'],
            'paid_on' => ['required', 'date'],
            'note' => ['nullable', 'string', 'max:255'],
        ]);
        $unit = Unit::findOrFail($data['unit_id']);
        Payment::create($data + [
            'project_id' => $unit->project_id,
            'recorded_by' => auth()->id(),
        ]);
        return back()->with('status', 'Payment recorded.');
    }
}
