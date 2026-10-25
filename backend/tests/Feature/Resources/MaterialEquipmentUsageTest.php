<?php

namespace Tests\Feature\Resources;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class MaterialEquipmentUsageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'material_usage',
            'equipment_usage',
            'materials',
            'equipment',
            'project_phases',
            'projects',
            'audit_logs',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('projects', function (Blueprint $table) {
            $table->increments('project_id');
            $table->string('project_name');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('site_supervisor_id')->nullable();
            $table->string('status')->nullable();
        });

        Schema::create('project_phases', function (Blueprint $table) {
            $table->increments('phase_id');
            $table->unsignedBigInteger('project_id');
            $table->string('project_name')->nullable();
            $table->string('status')->nullable();
        });

        Schema::create('materials', function (Blueprint $table) {
            $table->increments('material_id');
            $table->string('material_name');
            $table->string('unit_of_measure')->nullable();
            $table->decimal('unit_cost', 15, 2)->default(0);
            $table->unsignedInteger('stock_quantity')->default(0);
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
        });

        Schema::create('material_usage', function (Blueprint $table) {
            $table->increments('material_usage_id');
            $table->unsignedBigInteger('material_id');
            $table->unsignedBigInteger('phase_id');
            $table->date('usage_date')->nullable();
            $table->decimal('quantity_used', 8, 2)->nullable();
            $table->decimal('unit_cost_at_use', 15, 6)->default(0);
            $table->decimal('computed_cost', 15, 2)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
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

        Schema::create('equipment_usage', function (Blueprint $table) {
            $table->increments('equipment_usage_id');
            $table->unsignedBigInteger('equipment_id');
            $table->unsignedBigInteger('phase_id');
            $table->date('usage_date')->nullable();
            $table->decimal('hours_used', 8, 2)->nullable();
            $table->decimal('hourly_rate_at_use', 15, 6)->default(0);
            $table->decimal('computed_cost', 15, 2)->nullable();
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
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

        DB::table('projects')->insert([
            ['project_id' => 1, 'project_name' => 'Assigned Site', 'site_supervisor_id' => 2000],
            ['project_id' => 2, 'project_name' => 'Other Site', 'site_supervisor_id' => 2001],
        ]);

        DB::table('project_phases')->insert([
            ['phase_id' => 1, 'project_id' => 1, 'project_name' => 'Phase One', 'status' => 'In Progress'],
            ['phase_id' => 2, 'project_id' => 2, 'project_name' => 'Phase Two', 'status' => 'In Progress'],
        ]);

        DB::table('materials')->insert([
            'material_id' => 1,
            'material_name' => 'Cement',
            'unit_of_measure' => 'bags',
            'unit_cost' => 250,
            'stock_quantity' => 10,
        ]);

        DB::table('equipment')->insert([
            ['equipment_id' => 1, 'equipment_name' => 'Mixer', 'equipment_type' => 'Mixer', 'hourly_rental_rate' => 500, 'equipment_status' => 'Available'],
            ['equipment_id' => 2, 'equipment_name' => 'Crane', 'equipment_type' => 'Crane', 'hourly_rental_rate' => 1000, 'equipment_status' => 'Under Maintenance'],
        ]);
    }

    private function actingAsRole(string $roleName, int $userId, string $idNumber): User
    {
        $role = new Role(['role_name' => $roleName]);
        $user = new User;
        $user->user_id = $userId;
        $user->id_number = $idNumber;
        $user->first_name = 'Test';
        $user->last_name = ucfirst(strtolower($roleName));
        $user->email = strtolower($idNumber).'@example.test';
        $user->is_active = true;
        $user->setRelation('role', $role);

        $this->actingAs($user, 'sanctum');

        return $user;
    }

    public function test_ss_material_usage_returns_the_created_id_and_reduces_stock(): void
    {
        $this->actingAsRole(Role::SITE_SUPERVISOR, 2000, 'SUP030001');

        $response = $this->postJson('/api/v1/ss/materials', [
            'material_id' => 1,
            'phase_id' => 1,
            'usage_date' => now()->toDateString(),
            'quantity_used' => 2,
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.material_usage_id', 1)
            ->assertJsonPath('data.quantity_used', 2);

        $this->assertDatabaseHas('materials', [
            'material_id' => 1,
            'stock_quantity' => 8,
        ]);
    }

    public function test_ss_equipment_usage_returns_the_created_id(): void
    {
        $this->actingAsRole(Role::SITE_SUPERVISOR, 2000, 'SUP030001');

        $this->postJson('/api/v1/ss/equipment', [
            'equipment_id' => 1,
            'phase_id' => 1,
            'usage_date' => now()->toDateString(),
            'hours_used' => 3,
        ])
            ->assertCreated()
            ->assertJsonPath('data.equipment_usage_id', 1)
            ->assertJsonPath('data.hours_used', 3);
    }

    public function test_ss_usage_rejects_future_dates_over_stock_and_other_sites(): void
    {
        $this->actingAsRole(Role::SITE_SUPERVISOR, 2000, 'SUP030001');

        $this->postJson('/api/v1/ss/materials', [
            'material_id' => 1,
            'phase_id' => 1,
            'usage_date' => now()->addDay()->toDateString(),
            'quantity_used' => 1,
        ])->assertStatus(422);

        $this->postJson('/api/v1/ss/materials', [
            'material_id' => 1,
            'phase_id' => 1,
            'usage_date' => now()->toDateString(),
            'quantity_used' => 11,
        ])->assertStatus(422);

        $this->postJson('/api/v1/ss/materials', [
            'material_id' => 1,
            'phase_id' => 2,
            'usage_date' => now()->toDateString(),
            'quantity_used' => 1,
        ])->assertForbidden();
    }

    public function test_ss_equipment_usage_rejects_maintenance_and_over_24_hours(): void
    {
        $this->actingAsRole(Role::SITE_SUPERVISOR, 2000, 'SUP030001');

        $this->postJson('/api/v1/ss/equipment', [
            'equipment_id' => 2,
            'phase_id' => 1,
            'usage_date' => now()->toDateString(),
            'hours_used' => 1,
        ])
            ->assertStatus(422)
            ->assertJsonPath('message', 'This equipment is under maintenance and cannot be used.');

        $this->postJson('/api/v1/ss/equipment', [
            'equipment_id' => 1,
            'phase_id' => 1,
            'usage_date' => now()->toDateString(),
            'hours_used' => 25,
        ])->assertStatus(422);
    }
}
