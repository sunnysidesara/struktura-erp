<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Site supervisors log attendance per shift, so the Workers Log can filter
 * morning and afternoon entries.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('labor_hour_log', function (Blueprint $table) {
            $table->enum('shift', ['Morning', 'Afternoon'])->default('Morning')->after('log_date');
        });
    }

    public function down(): void
    {
        Schema::table('labor_hour_log', function (Blueprint $table) {
            $table->dropColumn('shift');
        });
    }
};
