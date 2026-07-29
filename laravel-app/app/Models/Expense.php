<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Expense extends Model
{
    use HasFactory;

    protected $fillable = [
        'project_id', 'category', 'vendor', 'amount', 'expense_date',
        'description', 'receipt_path', 'raised_by',
        'stage1_status', 'stage1_by', 'stage1_at', 'stage1_reason',
        'final_status', 'final_by', 'final_at', 'final_reason',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'decimal:2',
            'expense_date' => 'date',
            'stage1_at' => 'datetime',
            'final_at' => 'datetime',
        ];
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function raiser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'raised_by');
    }

    public function stage1Approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'stage1_by');
    }

    public function finalApprover(): BelongsTo
    {
        return $this->belongsTo(User::class, 'final_by');
    }

    public function isFullyApproved(): bool
    {
        return $this->stage1_status === 'approved'
            && in_array($this->final_status, ['approved', 'not_required'], true);
    }

    public function isRejected(): bool
    {
        return $this->stage1_status === 'rejected' || $this->final_status === 'rejected';
    }
}
