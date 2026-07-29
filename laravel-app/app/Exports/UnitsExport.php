<?php

namespace App\Exports;

use App\Models\Unit;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class UnitsExport implements FromCollection, WithHeadings, WithMapping
{
    public function __construct(public ?int $projectId = null, public ?string $status = null) {}

    public function collection()
    {
        return Unit::with('project')
            ->when($this->projectId, fn($q) => $q->where('project_id', $this->projectId))
            ->when($this->status, fn($q) => $q->where('status', $this->status))
            ->orderBy('unit_number')->get();
    }

    public function headings(): array
    {
        return ['Project', 'Unit #', 'Price', 'Status', 'Buyer', 'Buyer contact', 'Sold at'];
    }

    public function map($u): array
    {
        return [
            $u->project?->name ?? '',
            $u->unit_number,
            (float) $u->price,
            $u->status,
            $u->buyer_name ?? '',
            $u->buyer_contact ?? '',
            $u->sold_at?->format('Y-m-d') ?? '',
        ];
    }
}
