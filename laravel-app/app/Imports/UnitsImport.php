<?php

namespace App\Imports;

use App\Models\Unit;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\SkipsOnError;
use Maatwebsite\Excel\Concerns\SkipsErrors;

class UnitsImport implements ToModel, WithHeadingRow, SkipsOnError
{
    use SkipsErrors;

    public function __construct(public int $projectId) {}

    public function model(array $row)
    {
        if (empty($row['unit_number'])) return null;

        return new Unit([
            'project_id' => $this->projectId,
            'unit_number' => (string) $row['unit_number'],
            'price' => (float) ($row['price'] ?? 0),
            'status' => strtolower($row['status'] ?? 'available'),
            'attributes' => array_filter([
                'bhk' => $row['bhk'] ?? null,
                'floor' => $row['floor'] ?? null,
                'carpet' => $row['carpet'] ?? null,
                'facing' => $row['facing'] ?? null,
                'dimensions' => $row['dimensions'] ?? null,
            ]),
        ]);
    }
}
