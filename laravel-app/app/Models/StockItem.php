<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockItem extends Model
{
    use HasFactory;

    protected $fillable = ['project_id', 'name', 'unit', 'opening'];

    protected function casts(): array
    {
        return ['opening' => 'decimal:2'];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function movements(): HasMany
    {
        return $this->hasMany(StockMovement::class);
    }

    public function inwardTotal(): float
    {
        return (float) $this->movements()->where('kind', 'inward')->sum('quantity');
    }

    public function outwardTotal(): float
    {
        return (float) $this->movements()->where('kind', 'outward')->sum('quantity');
    }

    public function closing(): float
    {
        return (float) $this->opening + $this->inwardTotal() - $this->outwardTotal();
    }
}
