<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Example accounts covering every role (default password: "password").
 *
 * Account ID format: prefix + role code + 4-digit serial.
 *   SYS01xxxx = System Administrator, PM02xxxx = Project Manager, SUP03xxxx = Site Supervisor
 */
class ExampleUsersSeeder extends Seeder
{
    public function run(): void
    {
        $roleIds = Role::pluck('role_id', 'role_name');

        $users = [
            ['id_number' => 'SYS010002', 'role' => Role::ADMIN, 'first_name' => 'Alicia', 'last_name' => 'Mendoza', 'email' => 'alicia.mendoza@struktura.test'],
            ['id_number' => 'SYS010003', 'role' => Role::ADMIN, 'first_name' => 'Carlos', 'last_name' => 'Reyes', 'email' => 'carlos.reyes@struktura.test'],
            ['id_number' => 'PM020001', 'role' => Role::PROJECT_MANAGER, 'first_name' => 'Marcus', 'last_name' => 'Dela Cruz', 'email' => 'marcus.delacruz@struktura.test'],
            ['id_number' => 'PM020002', 'role' => Role::PROJECT_MANAGER, 'first_name' => 'Leah', 'last_name' => 'Ramos', 'email' => 'leah.ramos@struktura.test'],
            ['id_number' => 'PM020003', 'role' => Role::PROJECT_MANAGER, 'first_name' => 'Jessa', 'last_name' => 'Valdez', 'email' => 'jessa.valdez@struktura.test'],
            ['id_number' => 'PM020004', 'role' => Role::PROJECT_MANAGER, 'first_name' => 'Paolo', 'last_name' => 'Garcia', 'email' => 'paolo.garcia@struktura.test'],
            ['id_number' => 'SUP030001', 'role' => Role::SITE_SUPERVISOR, 'first_name' => 'Rafael', 'last_name' => 'Santos', 'email' => 'rafael.santos@struktura.test'],
            ['id_number' => 'SUP030002', 'role' => Role::SITE_SUPERVISOR, 'first_name' => 'Bryan', 'last_name' => 'Santos', 'email' => 'bryan.santos@struktura.test'],
            ['id_number' => 'SUP030003', 'role' => Role::SITE_SUPERVISOR, 'first_name' => 'Nina', 'last_name' => 'Santos', 'email' => 'nina.santos@struktura.test'],
            ['id_number' => 'SUP030004', 'role' => Role::SITE_SUPERVISOR, 'first_name' => 'Diego', 'last_name' => 'Flores', 'email' => 'diego.flores@struktura.test'],
        ];

        foreach ($users as $user) {
            $roleId = $roleIds[$user['role']] ?? null;

            if (! $roleId) {
                continue;
            }

            User::updateOrCreate(
                ['id_number' => $user['id_number']],
                [
                    'role_id' => $roleId,
                    'first_name' => $user['first_name'],
                    'last_name' => $user['last_name'],
                    'email' => $user['email'],
                    'password_hash' => 'password', // The model's 'hashed' cast hashes it once.
                    'is_active' => true,
                ],
            );
        }
    }
}