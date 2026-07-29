<?php

namespace App\Exports;

use App\Models\Payment;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class PaymentsExport implements FromCollection, WithHeadings, WithMapping
{
    public function __construct(public ?int $projectId = null) {}

    public function collection()
    {
        return Payment::with(['project', 'unit'])
            ->when($this->projectId, fn($q) => $q->where('project_id', $this->projectId))
            ->orderBy('paid_on', 'desc')->get();
    }

    public function headings(): array
    {
        return ['Date', 'Project', 'Unit', 'Mode', 'Amount', 'Note'];
    }

    public function map($p): array
    {
        return [
            $p->paid_on->format('Y-m-d'),
            $p->project?->name,
            $p->unit?->unit_number,
            $p->mode,
            (float) $p->amount,
            $p->note,
        ];
    }
}
