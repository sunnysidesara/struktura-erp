<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Site Supervisor console needs resource budgets per project plus a place to
 * record that a supervisor asked the Project Manager to sign a phase off.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->decimal('materials_budget', 15, 2)->default(0)->after('approved_budget');
            $table->decimal('equipment_budget', 15, 2)->default(0)->after('materials_budget');
        });

        Schema::table('project_phases', function (Blueprint $table) {
            $table->timestamp('completion_requested_at')->nullable()->after('status');
            $table->unsignedBigInteger('completion_requested_by')->nullable()->after('completion_requested_at');
        });

        // Default allocation policy for existing projects: 50% of the approved
        // budget is provisioned for materials and 15% for equipment.
        DB::table('projects')->update([
            'materials_budget' => DB::raw('ROUND(approved_budget * 0.50, 2)'),
            'equipment_budget' => DB::raw('ROUND(approved_budget * 0.15, 2)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('project_phases', function (Blueprint $table) {
            $table->dropColumn(['completion_requested_at', 'completion_requested_by']);
        });

        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn(['materials_budget', 'equipment_budget']);
        });
    }
};
