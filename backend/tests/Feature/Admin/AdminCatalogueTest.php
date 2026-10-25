<?php

namespace Tests\Feature\Admin;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminCatalogueTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'materials',
            'equipment',
            'material_usage',
            'equipment_usage',
            'suppliers',
            'audit_logs',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('materials', function (Blueprint $table) {
            $table->increments('material_id');
            $table->string('material_name');
            $table->string('unit_of_measure')->nullable();
            $table->decimal('unit_cost', 15, 2)->default(0);
            $table->unsignedInteger('stock_quantity')->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('equipment', function (Blueprint $table) {
            $table->increments('equipment_id');
            $table->string('equipment_name');
            $table->string('equipment_type')->nullable();
            $table->decimal('hourly_rental_rate', 15, 2)->default(0);
            $table->string('equipment_status')->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('material_usage', function (Blueprint $table) {
            $table->increments('material_usage_id');
            $table->unsignedBigInteger('material_id');
        });

        Schema::create('equipment_usage', function (Blueprint $table) {
            $table->increments('equipment_usage_id');
            $table->unsignedBigInteger('equipment_id');
        });

        Schema::create('suppliers', function (Blueprint $table) {
            $table->increments('supplier_id');
            $table->string('supplier_name');
            $table->string('contact_name')->nullable();
            $table->string('contact_num')->nullable();
            $table->string('city')->nullable();
            $table->string('state_province')->nullable();
            $table->string('country')->nullable();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->increments('audit_log_id');
            $table->unsignedBigInteger('project_id')->nullable();
            $table->string('table_name');
            $table->unsignedBigInteger('record_id');
            $table->string('action_type');
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->unsignedBigInteger('changed_by')->nullable();
            $table->timestamp('charge_at')->nullable();
        });

        $role = new Role(['role_name' => Role::ADMIN]);
        $admin = new User;
        $admin->user_id = 999;
        $admin->id_number = 'SYS010001';
        $admin->first_name = 'Test';
        $admin->last_name = 'Admin';
        $admin->email = 'admin@example.test';
        $admin->is_active = true;
        $admin->setRelation('role', $role);

        $this->actingAs($admin, 'sanctum');
    }

    private function materialPayload(array $overrides = []): array
    {
        return array_merge([
            'material_name' => 'Test Rebar',
            'unit_of_measure' => 'pieces',
            'unit_cost' => 125.50,
            'stock_quantity' => 40,
        ], $overrides);
    }

    private function equipmentPayload(array $overrides = []): array
    {
        return array_merge([
            'equipment_name' => 'Test Excavator',
            'equipment_type' => 'Excavator',
            'hourly_rental_rate' => 1500,
            'equipment_status' => 'Available',
        ], $overrides);
    }

    public function test_admin_can_create_update_and_delete_a_material(): void
    {
        $created = $this->postJson('/api/v1/admin/materials', $this->materialPayload())
            ->assertCreated()
            ->assertJsonPath('data.material_name', 'Test Rebar');

        $id = (int) $created->json('data.material_id');

        $this->putJson("/api/v1/admin/materials/{$id}", $this->materialPayload([
            'material_name' => 'Updated Rebar',
            'stock_quantity' => 55,
        ]))
            ->assertOk()
            ->assertJsonPath('data.material_name', 'Updated Rebar')
            ->assertJsonPath('data.stock_quantity', 55);

        $this->deleteJson("/api/v1/admin/materials/{$id}")
            ->assertOk()
            ->assertJsonPath('message', 'Material deleted successfully.');

        $this->assertDatabaseMissing('materials', ['material_id' => $id]);
        $this->assertDatabaseCount('audit_logs', 3);
    }

    public function test_admin_can_create_update_and_delete_equipment(): void
    {
        $created = $this->postJson('/api/v1/admin/equipment', $this->equipmentPayload())
            ->assertCreated()
            ->assertJsonPath('data.equipment_name', 'Test Excavator');

        $id = (int) $created->json('data.equipment_id');

        $this->putJson("/api/v1/admin/equipment/{$id}", $this->equipmentPayload([
            'equipment_name' => 'Updated Excavator',
        ]))
            ->assertOk()
            ->assertJsonPath('data.equipment_name', 'Updated Excavator')
            ->assertJsonPath('data.equipment_status', 'Available');

        $this->patchJson("/api/v1/admin/equipment/{$id}/status", [
            'status' => 'Under Maintenance',
        ])
            ->assertOk()
            ->assertJsonPath('data.equipment_status', 'Under Maintenance');

        $this->deleteJson("/api/v1/admin/equipment/{$id}")
            ->assertOk()
            ->assertJsonPath('message', 'Equipment deleted successfully.');

        $this->assertDatabaseMissing('equipment', ['equipment_id' => $id]);
        $this->assertDatabaseCount('audit_logs', 4);
    }

    public function test_material_with_usage_cannot_be_deleted(): void
    {
        $created = $this->postJson('/api/v1/admin/materials', $this->materialPayload())->assertCreated();
        $id = (int) $created->json('data.material_id');

        DB::table('material_usage')->insert(['material_id' => $id]);

        $this->deleteJson("/api/v1/admin/materials/{$id}")
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'This material has usage records and cannot be deleted.',
            );

        $this->assertDatabaseHas('materials', ['material_id' => $id]);
    }

    public function test_equipment_with_usage_cannot_be_deleted(): void
    {
        $created = $this->postJson('/api/v1/admin/equipment', $this->equipmentPayload())->assertCreated();
        $id = (int) $created->json('data.equipment_id');

        DB::table('equipment_usage')->insert(['equipment_id' => $id]);

        $this->deleteJson("/api/v1/admin/equipment/{$id}")
            ->assertStatus(422)
            ->assertJsonPath(
                'message',
                'This equipment has usage records and cannot be deleted.',
            );

        $this->assertDatabaseHas('equipment', ['equipment_id' => $id]);
    }

    public function test_catalogue_validation_rejects_duplicates_and_ignores_status_on_create(): void
    {
        $this->postJson('/api/v1/admin/materials', $this->materialPayload())->assertCreated();

        $this->postJson('/api/v1/admin/materials', $this->materialPayload())
            ->assertStatus(422)
            ->assertJsonValidationErrors('material_name');

        $this->postJson('/api/v1/admin/equipment', $this->equipmentPayload([
            'equipment_status' => 'Broken',
        ]))
            ->assertCreated()
            ->assertJsonPath('data.equipment_status', 'Available');
    }

    public function test_catalogue_names_are_trimmed_and_resources_include_usage_counts(): void
    {
        $material = $this->postJson('/api/v1/admin/materials', $this->materialPayload([
            'material_name' => '  Test Rebar  ',
            'unit_of_measure' => '  pieces  ',
        ]))
            ->assertCreated()
            ->assertJsonPath('data.material_name', 'Test Rebar')
            ->assertJsonPath('data.unit_of_measure', 'pieces');

        $equipment = $this->postJson('/api/v1/admin/equipment', $this->equipmentPayload([
            'equipment_name' => '  Test Excavator  ',
            'equipment_type' => '  Excavator  ',
        ]))
            ->assertCreated()
            ->assertJsonPath('data.equipment_name', 'Test Excavator')
            ->assertJsonPath('data.equipment_type', 'Excavator');

        DB::table('material_usage')->insert([
            'material_id' => $material->json('data.material_id'),
        ]);
        DB::table('equipment_usage')->insert([
            'equipment_id' => $equipment->json('data.equipment_id'),
        ]);

        $this->getJson('/api/v1/admin/resources')
            ->assertOk()
            ->assertJsonPath('materials.0.material_name', 'Test Rebar')
            ->assertJsonPath('materials.0.usage_count', 1)
            ->assertJsonPath('equipment.0.equipment_name', 'Test Excavator')
            ->assertJsonPath('equipment.0.usage_count', 1);
    }

    public function test_non_admin_cannot_manage_the_catalogue(): void
    {
        $role = new Role(['role_name' => Role::PROJECT_MANAGER]);
        $manager = new User;
        $manager->user_id = 1000;
        $manager->id_number = 'PM020001';
        $manager->first_name = 'Project';
        $manager->last_name = 'Manager';
        $manager->email = 'pm@example.test';
        $manager->is_active = true;
        $manager->setRelation('role', $role);

        $this->actingAs($manager, 'sanctum')
            ->postJson('/api/v1/admin/materials', $this->materialPayload())
            ->assertForbidden();
    }
}
