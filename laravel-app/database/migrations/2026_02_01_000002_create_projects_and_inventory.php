<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('projects', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->enum('project_type', ['residential', 'commercial', 'plot', 'villa', 'mixed'])->default('residential');
            $table->string('developer')->nullable();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('state')->nullable();
            $table->string('pincode', 10)->nullable();
            $table->string('rera_number')->nullable();
            $table->date('start_date')->nullable();
            $table->date('expected_completion')->nullable();
            $table->unsignedInteger('total_units_planned')->default(0);
            $table->decimal('target_revenue', 15, 2)->default(0);
            $table->string('image_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('unit_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->decimal('base_price', 15, 2)->default(0);
            $table->json('attributes')->nullable();
            $table->timestamps();
        });

        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('unit_type_id')->nullable()->constrained()->nullOnDelete();
            $table->string('unit_number');
            $table->decimal('price', 15, 2)->default(0);
            $table->enum('status', ['available', 'reserved', 'sold', 'cancelled'])->default('available');
            $table->json('attributes')->nullable();
            $table->string('buyer_name')->nullable();
            $table->string('buyer_contact')->nullable();
            $table->timestamp('sold_at')->nullable();
            $table->timestamp('reservation_expires_at')->nullable();
            $table->timestamps();
            $table->unique(['project_id', 'unit_number']);
        });

        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->foreignId('unit_id')->constrained()->cascadeOnDelete();
            $table->decimal('amount', 15, 2);
            $table->enum('mode', ['bank', 'cash', 'upi', 'cheque'])->default('bank');
            $table->date('paid_on');
            $table->string('note')->nullable();
            $table->foreignId('recorded_by')->constrained('users');
            $table->timestamps();
        });

        Schema::create('revenue_targets', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->enum('period_type', ['monthly', 'quarterly']);
            $table->string('period_key');  // e.g. 2026-02 or 2026-Q1
            $table->decimal('amount', 15, 2);
            $table->timestamps();
            $table->unique(['project_id', 'period_type', 'period_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('revenue_targets');
        Schema::dropIfExists('payments');
        Schema::dropIfExists('units');
        Schema::dropIfExists('unit_types');
        Schema::dropIfExists('projects');
    }
};
