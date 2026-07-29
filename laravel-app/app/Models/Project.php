<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    use HasFactory;

    protected $fillable = [
        'name', 'project_type', 'developer', 'address', 'city', 'state',
        'pincode', 'rera_number', 'start_date', 'expected_completion',
        'total_units_planned', 'target_revenue', 'image_path', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'expected_completion' => 'date',
            'target_revenue' => 'decimal:2',
            'is_active' => 'boolean',
        ];
    }

    public function users(): BelongsToMany
    {
        return $this->belongsToMany(User::class);
    }

    public function units(): HasMany
    {
        return $this->hasMany(Unit::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class);
    }

    public function expenses(): HasMany
    {
        return $this->hasMany(Expense::class);
    }

    public function stockItems(): HasMany
    {
        return $this->hasMany(StockItem::class);
    }

    public function revenueTargets(): HasMany
    {
        return $this->hasMany(RevenueTarget::class);
    }
}
