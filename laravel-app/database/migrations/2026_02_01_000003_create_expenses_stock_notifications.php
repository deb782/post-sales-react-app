<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('expenses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('category');
            $table->string('vendor')->nullable();
            $table->decimal('amount', 15, 2);
            $table->date('expense_date');
            $table->text('description')->nullable();
            $table->string('receipt_path')->nullable();
            $table->foreignId('raised_by')->constrained('users');
            $table->enum('stage1_status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->foreignId('stage1_by')->nullable()->constrained('users');
            $table->timestamp('stage1_at')->nullable();
            $table->text('stage1_reason')->nullable();
            $table->enum('final_status', ['pending', 'approved', 'rejected', 'not_required'])->default('pending');
            $table->foreignId('final_by')->nullable()->constrained('users');
            $table->timestamp('final_at')->nullable();
            $table->text('final_reason')->nullable();
            $table->timestamps();
            $table->index(['project_id', 'stage1_status', 'final_status']);
        });

        Schema::create('stock_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('unit');  // bag, ton, piece, m3
            $table->decimal('opening', 12, 2)->default(0);
            $table->timestamps();
            $table->unique(['project_id', 'name']);
        });

        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stock_item_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->enum('kind', ['inward', 'outward']);
            $table->decimal('quantity', 12, 2);
            $table->date('moved_on');
            $table->string('note')->nullable();
            $table->foreignId('recorded_by')->constrained('users');
            $table->timestamps();
        });

        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('kind');
            $table->string('message', 500);
            $table->string('entity_type')->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->boolean('is_read')->default(false);
            $table->timestamps();
            $table->index(['user_id', 'is_read']);
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('actor_role')->nullable();
            $table->string('action');
            $table->string('entity_type')->nullable();
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('meta')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['entity_type', 'entity_id']);
            $table->index('created_at');
        });

        Schema::create('settings', function (Blueprint $table) {
            $table->id();
            $table->string('company_name');
            $table->string('currency', 8)->default('INR');
            $table->decimal('threshold_amount', 15, 2)->default(50000);
            $table->string('logo_path')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('settings');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('notifications');
        Schema::dropIfExists('stock_movements');
        Schema::dropIfExists('stock_items');
        Schema::dropIfExists('expenses');
    }
};
