<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Supervisors now record attendance as Time In / Time Out instead of raw hours.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('labor_hour_log', function (Blueprint $table) {
            $table->time('time_in')->nullable()->after('shift');
            $table->time('time_out')->nullable()->after('time_in');
        });
    }

    public function down(): void
    {
        Schema::table('labor_hour_log', function (Blueprint $table) {
            $table->dropColumn(['time_in', 'time_out']);
        });
    }
};
