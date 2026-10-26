<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Phases now carry their own materials/equipment allocations so the PM can
 * break a phase budget down by resource.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('project_phases', function (Blueprint $table) {
            $table->decimal('materials_budget', 15, 2)->default(0)->after('project_cost');
            $table->decimal('equipment_budget', 15, 2)->default(0)->after('materials_budget');
        });
    }

    public function down(): void
    {
        Schema::table('project_phases', function (Blueprint $table) {
            $table->dropColumn(['materials_budget', 'equipment_budget']);
        });
    }
};
