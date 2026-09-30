<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * TEMPORARY — Dummy admin account for local development.
 *
 * This seeded account exists only so the login and User/Role Management
 * endpoints can be exercised before the real MySQL database is created.
 * Delete this seeder (and its DatabaseSeeder call) once real accounts
 * are provisioned.
 */
class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $adminRoleId = Role::where('role_name', Role::ADMIN)->value('role_id');

        User::updateOrCreate(
            ['email' => 'admin@struktura.test'],
            [
                'role_id' => $adminRoleId,
                'first_name' => 'Dummy',
                'last_name' => 'Admin',
                // Default credential for local development only.
                'password_hash' => Hash::make('password'),
                'is_active' => true,
            ],
        );
    }
}
