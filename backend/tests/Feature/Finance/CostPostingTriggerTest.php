<?php

namespace Tests\Feature\Finance;

use App\Support\CostPostingTriggers;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CostPostingTriggerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach ([
            'labor_hour_log',
            'material_usage',
            'equipment_usage',
            'workforce_assignment',
            'project_phases',
            'projects',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('projects', function (Blueprint $table) {
            $table->increments('project_id');
            $table->decimal('remaining_budget', 15, 2)->default(0);
            $table->timestamps();
        });

        Schema::create('project_phases', function (Blueprint $table) {
            $table->increments('phase_id');
            $table->unsignedBigInteger('project_id');
        });

        Schema::create('workforce_assignment', function (Blueprint $table) {
            $table->increments('assignment_id');
            $table->unsignedBigInteger('phase_id');
        });

        Schema::create('labor_hour_log', function (Blueprint $table) {
            $table->increments('log_id');
            $table->unsignedBigInteger('assignment_id');
            $table->decimal('regular_hours', 8, 2)->default(0);
            $table->decimal('overtime_hours', 8, 2)->default(0);
            $table->decimal('hourly_rate_at_use', 15, 6)->default(0);
            $table->decimal('computed_cost', 15, 2)->storedAs(
                'ROUND(COALESCE(regular_hours,0) * COALESCE(hourly_rate_at_use,0) + COALESCE(overtime_hours,0) * COALESCE(hourly_rate_at_use,0) * 1.25, 2)'
            );
        });

        Schema::create('material_usage', function (Blueprint $table) {
            $table->increments('material_usage_id');
            $table->unsignedBigInteger('phase_id');
            $table->decimal('quantity_used', 8, 2)->default(0);
            $table->decimal('unit_cost_at_use', 15, 6)->default(0);
            $table->decimal('computed_cost', 15, 2)->storedAs(
                'ROUND(COALESCE(quantity_used,0) * COALESCE(unit_cost_at_use,0), 2)'
            );
        });

        Schema::create('equipment_usage', function (Blueprint $table) {
            $table->increments('equipment_usage_id');
            $table->unsignedBigInteger('phase_id');
            $table->decimal('hours_used', 8, 2)->default(0);
            $table->decimal('hourly_rate_at_use', 15, 6)->default(0);
            $table->decimal('computed_cost', 15, 2)->storedAs(
                'ROUND(COALESCE(hours_used,0) * COALESCE(hourly_rate_at_use,0), 2)'
            );
        });

        DB::table('projects')->insert([
            ['project_id' => 1, 'remaining_budget' => 1000],
            ['project_id' => 2, 'remaining_budget' => 500],
        ]);

        DB::table('project_phases')->insert([
            ['phase_id' => 1, 'project_id' => 1],
            ['phase_id' => 2, 'project_id' => 2],
        ]);

        DB::table('workforce_assignment')->insert([
            ['assignment_id' => 1, 'phase_id' => 1],
            ['assignment_id' => 2, 'phase_id' => 2],
        ]);

        CostPostingTriggers::install(DB::connection());
    }

    private function budget(int $projectId): float
    {
        return (float) DB::table('projects')->where('project_id', $projectId)->value('remaining_budget');
    }

    public function test_material_triggers_deduct_refund_and_move_between_projects(): void
    {
        DB::table('material_usage')->insert([
            'material_usage_id' => 1,
            'phase_id' => 1,
            'quantity_used' => 1,
            'unit_cost_at_use' => 100,
        ]);

        $this->assertSame(900.0, $this->budget(1));

        DB::table('material_usage')->where('material_usage_id', 1)->update([
            'unit_cost_at_use' => 150,
        ]);

        $this->assertSame(850.0, $this->budget(1));

        DB::table('material_usage')->where('material_usage_id', 1)->update([
            'phase_id' => 2,
        ]);

        $this->assertSame(1000.0, $this->budget(1));
        $this->assertSame(350.0, $this->budget(2));

        DB::table('material_usage')->where('material_usage_id', 1)->delete();

        $this->assertSame(1000.0, $this->budget(1));
        $this->assertSame(500.0, $this->budget(2));
    }

    public function test_equipment_triggers_deduct_refund_and_move_between_projects(): void
    {
        DB::table('equipment_usage')->insert([
            'equipment_usage_id' => 1,
            'phase_id' => 1,
            'hours_used' => 1,
            'hourly_rate_at_use' => 40,
        ]);

        $this->assertSame(960.0, $this->budget(1));

        DB::table('equipment_usage')->where('equipment_usage_id', 1)->update([
            'phase_id' => 2,
            'hourly_rate_at_use' => 60,
        ]);

        $this->assertSame(1000.0, $this->budget(1));
        $this->assertSame(440.0, $this->budget(2));

        DB::table('equipment_usage')->where('equipment_usage_id', 1)->delete();

        $this->assertSame(1000.0, $this->budget(1));
        $this->assertSame(500.0, $this->budget(2));
    }

    public function test_labor_triggers_deduct_refund_and_move_between_projects(): void
    {
        DB::table('labor_hour_log')->insert([
            'log_id' => 1,
            'assignment_id' => 1,
            'regular_hours' => 1,
            'overtime_hours' => 0,
            'hourly_rate_at_use' => 80,
        ]);

        $this->assertSame(920.0, $this->budget(1));

        DB::table('labor_hour_log')->where('log_id', 1)->update([
            'assignment_id' => 2,
            'hourly_rate_at_use' => 120,
        ]);

        $this->assertSame(1000.0, $this->budget(1));
        $this->assertSame(380.0, $this->budget(2));

        DB::table('labor_hour_log')->where('log_id', 1)->delete();

        $this->assertSame(1000.0, $this->budget(1));
        $this->assertSame(500.0, $this->budget(2));
    }

    public function test_generated_cost_formulas_include_overtime_and_snapshot_rates(): void
    {
        DB::table('material_usage')->insert([
            'material_usage_id' => 2,
            'phase_id' => 1,
            'quantity_used' => 2,
            'unit_cost_at_use' => 10.5,
        ]);

        DB::table('equipment_usage')->insert([
            'equipment_usage_id' => 2,
            'phase_id' => 1,
            'hours_used' => 3.5,
            'hourly_rate_at_use' => 40,
        ]);

        DB::table('labor_hour_log')->insert([
            'log_id' => 2,
            'assignment_id' => 1,
            'regular_hours' => 2,
            'overtime_hours' => 2,
            'hourly_rate_at_use' => 100,
        ]);

        $this->assertSame(21.0, (float) DB::table('material_usage')->where('material_usage_id', 2)->value('computed_cost'));
        $this->assertSame(140.0, (float) DB::table('equipment_usage')->where('equipment_usage_id', 2)->value('computed_cost'));
        $this->assertSame(450.0, (float) DB::table('labor_hour_log')->where('log_id', 2)->value('computed_cost'));
    }

}
