<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Suppliers are no longer part of the Admin Resources module, so the supplier
 * catalogue and its material junction table are retired.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Drop the child table first because it references suppliers.
        Schema::dropIfExists('materials_suppliers');
        Schema::dropIfExists('suppliers');
    }

    public function down(): void
    {
        Schema::create('suppliers', function (Blueprint $table) {
            $table->bigIncrements('supplier_id');
            $table->string('supplier_name')->comment('Registered / trade name of the supplier');
            $table->string('contact_name')->nullable()->comment('Primary contact at the supplier');
            $table->string('contact_num', 50)->nullable()->comment('Contact phone number');
            $table->string('street_address')->nullable()->comment('Street address');
            $table->string('city', 100)->nullable()->comment('City');
            $table->string('state_province', 100)->nullable()->comment('State or province');
            $table->string('postal_code', 20)->nullable()->comment('Postal / ZIP code');
            $table->string('country', 100)->nullable()->comment('Country');
        });

        Schema::create('materials_suppliers', function (Blueprint $table) {
            $table->bigIncrements('material_suppliers_id');
            $table->unsignedBigInteger('material_id')->comment('FK -> materials.material_id');
            $table->unsignedBigInteger('supplier_id')->comment('FK -> suppliers.supplier_id');
            $table->unique(['material_id', 'supplier_id'], 'uq_materials_suppliers_pair');
            $table->index('supplier_id', 'idx_materials_suppliers_supplier_id');
            $table->foreign('material_id', 'fk_materials_suppliers_material')
                ->references('material_id')->on('materials')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
            $table->foreign('supplier_id', 'fk_materials_suppliers_supplier')
                ->references('supplier_id')->on('suppliers')
                ->cascadeOnUpdate()
                ->cascadeOnDelete();
        });
    }
};
