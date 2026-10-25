<?php

use App\Support\CostPostingTriggers;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $connection = DB::connection();

        if (! in_array($connection->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        $this->addSnapshotColumns();
        $this->backfillSnapshots();
        $this->assertSnapshotsMatch();

        CostPostingTriggers::drop($connection);

        try {
            DB::statement(
                'ALTER TABLE labor_hour_log MODIFY computed_cost DECIMAL(15,2) '
                .'GENERATED ALWAYS AS ('
                .'ROUND(COALESCE(regular_hours,0) * COALESCE(hourly_rate_at_use,0) '
                .'+ COALESCE(overtime_hours,0) * COALESCE(hourly_rate_at_use,0) * 1.25, 2)'
                .') STORED'
            );

            DB::statement(
                'ALTER TABLE material_usage MODIFY computed_cost DECIMAL(15,2) '
                .'GENERATED ALWAYS AS ('
                .'ROUND(COALESCE(quantity_used,0) * COALESCE(unit_cost_at_use,0), 2)'
                .') STORED'
            );

            DB::statement(
                'ALTER TABLE equipment_usage MODIFY computed_cost DECIMAL(15,2) '
                .'GENERATED ALWAYS AS ('
                .'ROUND(COALESCE(hours_used,0) * COALESCE(hourly_rate_at_use,0), 2)'
                .') STORED'
            );

            CostPostingTriggers::install($connection);
        } catch (Throwable $error) {
            // A failed DDL migration must not leave cost posting disabled.
            CostPostingTriggers::install($connection);
            throw $error;
        }
    }

    public function down(): void
    {
        $connection = DB::connection();

        if (! in_array($connection->getDriverName(), ['mysql', 'mariadb'], true)) {
            return;
        }

        CostPostingTriggers::drop($connection);

        try {
            DB::statement('ALTER TABLE labor_hour_log MODIFY computed_cost DECIMAL(15,2) NULL');
            DB::statement('ALTER TABLE material_usage MODIFY computed_cost DECIMAL(15,2) NULL');
            DB::statement('ALTER TABLE equipment_usage MODIFY computed_cost DECIMAL(15,2) NULL');

            DB::statement(
                'UPDATE labor_hour_log SET computed_cost = ROUND('
                .'COALESCE(regular_hours,0) * COALESCE(hourly_rate_at_use,0) '
                .'+ COALESCE(overtime_hours,0) * COALESCE(hourly_rate_at_use,0) * 1.25, 2)'
            );
            DB::statement(
                'UPDATE material_usage SET computed_cost = ROUND('
                .'COALESCE(quantity_used,0) * COALESCE(unit_cost_at_use,0), 2)'
            );
            DB::statement(
                'UPDATE equipment_usage SET computed_cost = ROUND('
                .'COALESCE(hours_used,0) * COALESCE(hourly_rate_at_use,0), 2)'
            );

            $this->dropSnapshotColumns();
            CostPostingTriggers::install($connection);
        } catch (Throwable $error) {
            CostPostingTriggers::install($connection);
            throw $error;
        }
    }

    private function addSnapshotColumns(): void
    {
        if (! Schema::hasColumn('labor_hour_log', 'hourly_rate_at_use')) {
            Schema::table('labor_hour_log', function (Blueprint $table) {
                $table->decimal('hourly_rate_at_use', 15, 6)
                    ->default(0)
                    ->after('overtime_hours');
            });
        }

        if (! Schema::hasColumn('material_usage', 'unit_cost_at_use')) {
            Schema::table('material_usage', function (Blueprint $table) {
                $table->decimal('unit_cost_at_use', 15, 6)
                    ->default(0)
                    ->after('quantity_used');
            });
        }

        if (! Schema::hasColumn('equipment_usage', 'hourly_rate_at_use')) {
            Schema::table('equipment_usage', function (Blueprint $table) {
                $table->decimal('hourly_rate_at_use', 15, 6)
                    ->default(0)
                    ->after('hours_used');
            });
        }
    }

    private function backfillSnapshots(): void
    {
        DB::statement(
            'UPDATE labor_hour_log SET hourly_rate_at_use = CASE '
            .'WHEN (COALESCE(regular_hours,0) + COALESCE(overtime_hours,0) * 1.25) = 0 THEN 0 '
            .'ELSE ROUND(COALESCE(computed_cost,0) / '
            .'(COALESCE(regular_hours,0) + COALESCE(overtime_hours,0) * 1.25), 6) END'
        );

        DB::statement(
            'UPDATE material_usage SET unit_cost_at_use = CASE '
            .'WHEN COALESCE(quantity_used,0) = 0 THEN 0 '
            .'ELSE ROUND(COALESCE(computed_cost,0) / quantity_used, 6) END'
        );

        DB::statement(
            'UPDATE equipment_usage SET hourly_rate_at_use = CASE '
            .'WHEN COALESCE(hours_used,0) = 0 THEN 0 '
            .'ELSE ROUND(COALESCE(computed_cost,0) / hours_used, 6) END'
        );
    }

    private function assertSnapshotsMatch(): void
    {
        $mismatches = [
            'labor' => DB::table('labor_hour_log')->whereRaw(
                'ROUND(COALESCE(regular_hours,0) * COALESCE(hourly_rate_at_use,0) '
                .'+ COALESCE(overtime_hours,0) * COALESCE(hourly_rate_at_use,0) * 1.25, 2) '
                .'<> ROUND(COALESCE(computed_cost,0), 2)'
            )->count(),
            'materials' => DB::table('material_usage')->whereRaw(
                'ROUND(COALESCE(quantity_used,0) * COALESCE(unit_cost_at_use,0), 2) '
                .'<> ROUND(COALESCE(computed_cost,0), 2)'
            )->count(),
            'equipment' => DB::table('equipment_usage')->whereRaw(
                'ROUND(COALESCE(hours_used,0) * COALESCE(hourly_rate_at_use,0), 2) '
                .'<> ROUND(COALESCE(computed_cost,0), 2)'
            )->count(),
        ];

        $total = array_sum($mismatches);

        if ($total > 0) {
            throw new RuntimeException(
                'Generated cost validation failed: '.json_encode($mismatches).'.'
            );
        }
    }

    private function dropSnapshotColumns(): void
    {
        Schema::table('labor_hour_log', function (Blueprint $table) {
            $table->dropColumn('hourly_rate_at_use');
        });

        Schema::table('material_usage', function (Blueprint $table) {
            $table->dropColumn('unit_cost_at_use');
        });

        Schema::table('equipment_usage', function (Blueprint $table) {
            $table->dropColumn('hourly_rate_at_use');
        });
    }

};
