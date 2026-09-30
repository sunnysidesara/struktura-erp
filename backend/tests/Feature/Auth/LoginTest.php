<?php

namespace Tests\Feature\Auth;

use App\Models\Role;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class LoginTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed();
    }

    public function test_dummy_admin_can_log_in_and_receives_a_token(): void
    {
        $response = $this->postJson('/api/v1/login', [
            'email' => 'admin@struktura.test',
            'password' => 'password',
        ]);

        $response->assertOk()
            ->assertJsonStructure([
                'message',
                'token',
                'user' => ['user_id', 'email', 'role' => ['role_id', 'role_name']],
            ])
            ->assertJsonPath('user.role.role_name', Role::ADMIN);

        $this->assertNotEmpty($response->json('token'));
    }

    public function test_login_fails_with_wrong_password(): void
    {
        $this->postJson('/api/v1/login', [
            'email' => 'admin@struktura.test',
            'password' => 'not-the-password',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_login_fails_for_inactive_account(): void
    {
        User::factory()->admin()->create([
            'email' => 'inactive@struktura.test',
            'is_active' => false,
        ]);

        $this->postJson('/api/v1/login', [
            'email' => 'inactive@struktura.test',
            'password' => 'password',
        ])->assertStatus(422)
            ->assertJsonValidationErrors('email');
    }

    public function test_authenticated_user_can_fetch_their_profile(): void
    {
        $user = User::where('email', 'admin@struktura.test')->firstOrFail();

        $this->actingAs($user, 'sanctum')
            ->getJson('/api/v1/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'admin@struktura.test');
    }

    public function test_logout_revokes_the_current_token(): void
    {
        $login = $this->postJson('/api/v1/login', [
            'email' => 'admin@struktura.test',
            'password' => 'password',
        ])->json();

        $this->assertDatabaseCount('personal_access_tokens', 1);

        $this->withHeader('Authorization', 'Bearer '.$login['token'])
            ->postJson('/api/v1/logout')
            ->assertOk();

        // The issued token must be gone after logout.
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }
}
