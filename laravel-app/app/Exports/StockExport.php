<?php

namespace App\Exports;

use App\Models\StockItem;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;
use Maatwebsite\Excel\Concerns\WithMapping;

class StockExport implements FromCollection, WithHeadings, WithMapping
{
    public function __construct(public ?int $projectId = null) {}

    public function collection()
    {
        return StockItem::when($this->projectId, fn($q) => $q->where('project_id', $this->projectId))
            ->orderBy('name')->get();
    }

    public function headings(): array
    {
        return ['Item', 'Unit', 'Opening', 'Inward', 'Outward', 'Closing'];
    }

    public function map($it): array
    {
        return [
            $it->name,
            $it->unit,
            (float) $it->opening,
            $it->inwardTotal(),
            $it->outwardTotal(),
            $it->closing(),
        ];
    }
}
