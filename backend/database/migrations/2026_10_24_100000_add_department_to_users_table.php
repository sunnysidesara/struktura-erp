<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Profiles show a department; the value is optional and managed by admins.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('department', 100)->nullable()->after('contact_number');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('department');
        });
    }
};
