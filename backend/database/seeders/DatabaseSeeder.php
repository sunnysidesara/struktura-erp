<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     *
     * The RoleSeeder runs first so the dummy Admin account has a role
     * to reference. Both seeders are temporary scaffolding for local
     * development; they will be replaced once the real MySQL database
     * and data are provisioned.
     */
    public function run(): void
    {
        $this->call([
            RoleSeeder::class,
            AdminUserSeeder::class,
        ]);
    }
}
