<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Setting extends Model
{
    protected $fillable = [
        'company_name', 'currency', 'threshold_amount', 'logo_path',
    ];

    protected function casts(): array
    {
        return ['threshold_amount' => 'decimal:2'];
    }

    public static function current(): self
    {
        return static::firstOrCreate(
            ['id' => 1],
            [
                'company_name' => config('app.company_name', 'Company'),
                'currency' => config('app.currency', 'INR'),
                'threshold_amount' => config('app.expense_threshold', 50000),
            ],
        );
    }
}
