<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class RoleSeeder extends Seeder
{
    /**
     * Seed the fixed set of system roles defined in the data dictionary.
     */
    public function run(): void
    {
        $roles = [
            [
                'role_name' => Role::ADMIN,
                'description' => 'Manages accounts, roles, reference data, and has full visibility across all projects and audit logs.',
            ],
            [
                'role_name' => Role::PROJECT_MANAGER,
                'description' => 'Owns construction projects, defines phases and budgets, and manages equipment and material master records.',
            ],
            [
                'role_name' => Role::SITE_SUPERVISOR,
                'description' => 'Records daily labor, material, and equipment usage for assigned projects only.',
            ],
        ];

        foreach ($roles as $role) {
            Role::updateOrCreate(
                ['role_name' => $role['role_name']],
                ['description' => $role['description']],
            );
        }
    }
}
