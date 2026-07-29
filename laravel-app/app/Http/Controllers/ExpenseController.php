<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Expense;
use App\Models\Notification;
use App\Models\Project;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class ExpenseController extends Controller
{
    public function index(Request $request): View
    {
        $user = $request->user();
        $projects = $user->hasRole('admin', 'accounts', 'management')
            ? Project::orderBy('name')->get()
            : $user->projects()->orderBy('name')->get();

        $q = Expense::with(['project', 'raiser'])
            ->whereIn('project_id', $projects->pluck('id'))
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $q->when($request->status === 'pending', fn($qq) => $qq->where('stage1_status', 'pending'))
              ->when($request->status === 'stage2', fn($qq) => $qq->where('stage1_status', 'approved')->where('final_status', 'pending'))
              ->when($request->status === 'approved', fn($qq) => $qq->where('stage1_status', 'approved')->whereIn('final_status', ['approved', 'not_required']))
              ->when($request->status === 'rejected', fn($qq) => $qq->where(fn($qqq) => $qqq->where('stage1_status', 'rejected')->orWhere('final_status', 'rejected')));
        }

        $expenses = $q->limit(200)->get();
        $threshold = (float) Setting::current()->threshold_amount;

        return view('expenses.index', compact('expenses', 'projects', 'threshold'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'project_id' => ['required', 'exists:projects,id'],
            'category' => ['required', 'string', 'max:80'],
            'vendor' => ['nullable', 'string', 'max:120'],
            'amount' => ['required', 'numeric', 'min:0'],
            'expense_date' => ['required', 'date'],
            'description' => ['nullable', 'string', 'max:2000'],
            'receipt' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $threshold = (float) Setting::current()->threshold_amount;

        $data['receipt_path'] = $request->hasFile('receipt')
            ? $request->file('receipt')->store('receipts', 'public') : null;
        $data['raised_by'] = auth()->id();
        $data['final_status'] = $data['amount'] > $threshold ? 'pending' : 'not_required';

        $exp = Expense::create($data);

        // Notify accounts users
        User::where('role', 'accounts')->where('is_active', true)->get()->each(function ($u) use ($exp) {
            Notification::create([
                'user_id' => $u->id,
                'kind' => 'expense_stage1_pending',
                'message' => "Expense of ₹".number_format($exp->amount)." from {$exp->vendor} needs stage-1 approval.",
                'entity_type' => 'expense', 'entity_id' => $exp->id,
            ]);
        });

        $this->audit('expense.raise', $exp->id, ['amount' => (float) $exp->amount]);
        return back()->with('status', 'Expense raised.');
    }

    public function stage1(Request $request, Expense $expense): RedirectResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);
        if ($data['decision'] === 'rejected' && empty($data['reason'])) {
            return back()->withErrors(['reason' => 'Reason is required for rejection.']);
        }

        $expense->update([
            'stage1_status' => $data['decision'],
            'stage1_by' => auth()->id(),
            'stage1_at' => now(),
            'stage1_reason' => $data['reason'] ?? null,
        ]);

        // Notify raiser + (if approved & over threshold) management
        Notification::create([
            'user_id' => $expense->raised_by,
            'kind' => "expense_stage1_{$data['decision']}",
            'message' => "Your expense (₹".number_format($expense->amount).") was ".$data['decision']." at stage 1.",
            'entity_type' => 'expense', 'entity_id' => $expense->id,
        ]);

        if ($data['decision'] === 'approved' && $expense->final_status === 'pending') {
            User::where('role', 'management')->where('is_active', true)->get()->each(function ($u) use ($expense) {
                Notification::create([
                    'user_id' => $u->id,
                    'kind' => 'expense_final_pending',
                    'message' => "Expense (₹".number_format($expense->amount).") pending your final approval.",
                    'entity_type' => 'expense', 'entity_id' => $expense->id,
                ]);
            });
        }

        $this->audit("expense.stage1.{$data['decision']}", $expense->id, ['reason' => $data['reason'] ?? null]);
        return back()->with('status', 'Stage-1 decision saved.');
    }

    public function final(Request $request, Expense $expense): RedirectResponse
    {
        $data = $request->validate([
            'decision' => ['required', 'in:approved,rejected'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);
        if ($data['decision'] === 'rejected' && empty($data['reason'])) {
            return back()->withErrors(['reason' => 'Reason is required for rejection.']);
        }

        $expense->update([
            'final_status' => $data['decision'],
            'final_by' => auth()->id(),
            'final_at' => now(),
            'final_reason' => $data['reason'] ?? null,
        ]);

        Notification::create([
            'user_id' => $expense->raised_by,
            'kind' => "expense_final_{$data['decision']}",
            'message' => "Your expense (₹".number_format($expense->amount).") was ".$data['decision']." at final stage.",
            'entity_type' => 'expense', 'entity_id' => $expense->id,
        ]);

        $this->audit("expense.final.{$data['decision']}", $expense->id, ['reason' => $data['reason'] ?? null]);
        return back()->with('status', 'Final decision saved.');
    }

    private function audit(string $action, int $entityId, array $meta): void
    {
        AuditLog::create([
            'actor_id' => auth()->id(),
            'actor_role' => auth()->user()->role,
            'action' => $action,
            'entity_type' => 'expense',
            'entity_id' => $entityId,
            'meta' => $meta,
            'created_at' => now(),
        ]);
    }
}
