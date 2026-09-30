<?php

namespace Tests\Feature\User;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    private function admin(): User
    {
        return User::where('email', 'admin@struktura.test')->firstOrFail();
    }

    private function projectManagerRoleId(): int
    {
        return Role::where('role_name', Role::PROJECT_MANAGER)->value('role_id');
    }

    public function test_admin_can_create_a_user(): void
    {
        $this->actingAs($this->admin(), 'sanctum')
            ->postJson('/api/v1/users', [
                'role_id' => $this->projectManagerRoleId(),
                'first_name' => 'Pat',
                'last_name' => 'Manager',
                'email' => 'pat@struktura.test',
                'password' => 'secret-password',
                'password_confirmation' => 'secret-password',
            ])
            ->assertCreated()
            ->assertJsonPath('data.role_name', Role::PROJECT_MANAGER);

        $this->assertDatabaseHas('users', ['email' => 'pat@struktura.test']);
        // Password must never be returned or stored in plain text.
        $this->assertDatabaseMissing('users', ['password_hash' => 'secret-password']);
    }

    public function test_admin_can_list_users(): void
    {
        $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/v1/users')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_admin_can_reassign_a_role(): void
    {
        $user = User::factory()->create();

        $this->actingAs($this->admin(), 'sanctum')
            ->patchJson("/api/v1/users/{$user->user_id}", [
                'role_id' => $this->projectManagerRoleId(),
            ])
            ->assertOk()
            ->assertJsonPath('data.role_name', Role::PROJECT_MANAGER);
    }

    public function test_admin_can_deactivate_and_reactivate_a_user(): void
    {
        $user = User::factory()->create();

        $this->actingAs($this->admin(), 'sanctum')
            ->patchJson("/api/v1/users/{$user->user_id}/deactivate")
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->actingAs($this->admin(), 'sanctum')
            ->patchJson("/api/v1/users/{$user->user_id}/activate")
            ->assertOk()
            ->assertJsonPath('data.is_active', true);
    }

    public function test_admin_cannot_deactivate_their_own_account(): void
    {
        $admin = $this->admin();

        $this->actingAs($admin, 'sanctum')
            ->patchJson("/api/v1/users/{$admin->user_id}/deactivate")
            ->assertStatus(422);
    }

    public function test_non_admin_cannot_access_user_management(): void
    {
        $supervisor = User::factory()->create(); // default role = Site Supervisor

        $this->actingAs($supervisor, 'sanctum')
            ->getJson('/api/v1/users')
            ->assertForbidden();
    }

    public function test_guests_cannot_access_user_management(): void
    {
        $this->getJson('/api/v1/users')->assertUnauthorized();
    }

    public function test_creating_a_user_requires_a_valid_role(): void
    {
        $this->actingAs($this->admin(), 'sanctum')
            ->postJson('/api/v1/users', [
                'role_id' => 99999,
                'first_name' => 'No',
                'last_name' => 'Role',
                'email' => 'norole@struktura.test',
                'password' => 'secret-password',
                'password_confirmation' => 'secret-password',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('role_id');
    }

    public function test_authenticated_user_can_list_roles(): void
    {
        $this->actingAs($this->admin(), 'sanctum')
            ->getJson('/api/v1/roles')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }
}
