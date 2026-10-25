<?php

namespace Tests\Feature\Pm;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SiteSupervisorDirectoryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach (['users', 'role'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('role', function (Blueprint $table) {
            $table->increments('role_id');
            $table->string('role_name');
        });

        Schema::create('users', function (Blueprint $table) {
            $table->increments('user_id');
            $table->unsignedInteger('role_id');
            $table->string('id_number');
            $table->string('first_name');
            $table->string('last_name');
            $table->string('email');
            $table->boolean('is_active')->default(true);
        });

        DB::table('role')->insert([
            ['role_id' => 1, 'role_name' => Role::PROJECT_MANAGER],
            ['role_id' => 2, 'role_name' => Role::SITE_SUPERVISOR],
        ]);

        DB::table('users')->insert([
            [
                'user_id' => 2000,
                'role_id' => 2,
                'id_number' => 'SUP030001',
                'first_name' => 'Active',
                'last_name' => 'Supervisor',
                'email' => 'active.sup@example.test',
                'is_active' => true,
            ],
            [
                'user_id' => 2001,
                'role_id' => 2,
                'id_number' => 'SUP030002',
                'first_name' => 'Inactive',
                'last_name' => 'Supervisor',
                'email' => 'inactive.sup@example.test',
                'is_active' => false,
            ],
        ]);

        $this->actingAsRole(Role::PROJECT_MANAGER, 1000, 'PM020001');
    }

    private function actingAsRole(string $roleName, int $userId, string $idNumber): User
    {
        $role = new Role(['role_name' => $roleName]);
        $user = new User;
        $user->user_id = $userId;
        $user->id_number = $idNumber;
        $user->first_name = 'Test';
        $user->last_name = 'Manager';
        $user->email = strtolower($idNumber).'@example.test';
        $user->is_active = true;
        $user->setRelation('role', $role);

        $this->actingAs($user, 'sanctum');

        return $user;
    }

    public function test_site_supervisor_directory_defaults_to_active_accounts_with_contact_data(): void
    {
        $this->getJson('/api/v1/pm/site-supervisors')
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.id_number', 'SUP030001')
            ->assertJsonPath('data.0.email', 'active.sup@example.test')
            ->assertJsonPath('data.0.is_active', true);
    }

    public function test_site_supervisor_directory_can_include_inactive_accounts(): void
    {
        $response = $this->getJson('/api/v1/pm/site-supervisors?include_inactive=1')
            ->assertOk()
            ->assertJsonCount(2, 'data');

        $inactive = collect($response->json('data'))
            ->firstWhere('id_number', 'SUP030002');

        $this->assertNotNull($inactive);
        $this->assertSame('inactive.sup@example.test', $inactive['email']);
        $this->assertFalse($inactive['is_active']);
    }
}
