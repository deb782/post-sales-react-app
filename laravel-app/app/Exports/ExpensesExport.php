<?php

namespace App\Exports;

use App\Models\Expense;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class ExpensesExport implements FromCollection, WithHeadings, WithMapping
{
    public function __construct(public ?int $projectId = null) {}

    public function collection()
    {
        return Expense::with(['project', 'raiser'])
            ->when($this->projectId, fn($q) => $q->where('project_id', $this->projectId))
            ->orderBy('expense_date', 'desc')->get();
    }

    public function headings(): array
    {
        return ['Date', 'Project', 'Category', 'Vendor', 'Amount', 'Raised by', 'Stage 1', 'Final', 'Description'];
    }

    public function map($e): array
    {
        return [
            $e->expense_date->format('Y-m-d'),
            $e->project?->name,
            $e->category,
            $e->vendor,
            (float) $e->amount,
            $e->raiser?->name,
            $e->stage1_status,
            $e->final_status,
            $e->description,
        ];
    }
}
