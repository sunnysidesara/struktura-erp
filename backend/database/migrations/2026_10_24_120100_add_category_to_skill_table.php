<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Skills are grouped by a real column instead of a hardcoded frontend map.
     */
    public function up(): void
    {
        Schema::table('skill', function (Blueprint $table) {
            $table->string('category', 100)->nullable()->after('description');
        });
    }

    public function down(): void
    {
        Schema::table('skill', function (Blueprint $table) {
            $table->dropColumn('category');
        });
    }
};
