<?php

namespace App\Support;

use Illuminate\Database\Connection;

/**
 * Installs the database triggers that post usage costs to the owning project.
 *
 * The application writes each usage row's snapshot rate; MySQL computes
 * computed_cost from that snapshot. These triggers only move the generated
 * amount through projects.remaining_budget. The SQL intentionally uses
 * portable correlated updates so the same behavior can be exercised by the
 * SQLite regression suite while MySQL receives the production triggers.
 */
class CostPostingTriggers
{
    /**
     * @var list<string>
     */
    public const NAMES = [
        'trg_labor_hour_log_cost_insert',
        'trg_labor_hour_log_cost_update',
        'trg_labor_hour_log_cost_delete',
        'trg_material_usage_cost_insert',
        'trg_material_usage_cost_update',
        'trg_material_usage_cost_delete',
        'trg_equipment_usage_cost_insert',
        'trg_equipment_usage_cost_update',
        'trg_equipment_usage_cost_delete',
    ];

    public static function install(Connection $connection): void
    {
        self::drop($connection);

        foreach (self::statements() as $statement) {
            $connection->unprepared($statement);
        }
    }

    public static function drop(Connection $connection): void
    {
        foreach (self::NAMES as $name) {
            $connection->unprepared('DROP TRIGGER IF EXISTS '.$name);
        }
    }

    /**
     * @return list<string>
     */
    public static function statements(): array
    {
        $laborProject = '(
            SELECT ph.project_id
            FROM workforce_assignment wa
            JOIN project_phases ph ON ph.phase_id = wa.phase_id
            WHERE wa.assignment_id = %s.assignment_id
        )';

        $phaseProject = '(
            SELECT project_id
            FROM project_phases
            WHERE phase_id = %s.phase_id
        )';

        return [
            self::createTrigger(
                'trg_labor_hour_log_cost_insert',
                'labor_hour_log',
                'INSERT',
                self::adjustment(
                    sprintf($laborProject, 'NEW'),
                    '-',
                    'NEW',
                ),
            ),
            self::createTrigger(
                'trg_labor_hour_log_cost_update',
                'labor_hour_log',
                'UPDATE',
                self::adjustment(sprintf($laborProject, 'OLD'), '+', 'OLD')
                .self::adjustment(sprintf($laborProject, 'NEW'), '-', 'NEW'),
            ),
            self::createTrigger(
                'trg_labor_hour_log_cost_delete',
                'labor_hour_log',
                'DELETE',
                self::adjustment(sprintf($laborProject, 'OLD'), '+', 'OLD'),
            ),
            self::createTrigger(
                'trg_material_usage_cost_insert',
                'material_usage',
                'INSERT',
                self::adjustment(sprintf($phaseProject, 'NEW'), '-', 'NEW'),
            ),
            self::createTrigger(
                'trg_material_usage_cost_update',
                'material_usage',
                'UPDATE',
                self::adjustment(sprintf($phaseProject, 'OLD'), '+', 'OLD')
                .self::adjustment(sprintf($phaseProject, 'NEW'), '-', 'NEW'),
            ),
            self::createTrigger(
                'trg_material_usage_cost_delete',
                'material_usage',
                'DELETE',
                self::adjustment(sprintf($phaseProject, 'OLD'), '+', 'OLD'),
            ),
            self::createTrigger(
                'trg_equipment_usage_cost_insert',
                'equipment_usage',
                'INSERT',
                self::adjustment(sprintf($phaseProject, 'NEW'), '-', 'NEW'),
            ),
            self::createTrigger(
                'trg_equipment_usage_cost_update',
                'equipment_usage',
                'UPDATE',
                self::adjustment(sprintf($phaseProject, 'OLD'), '+', 'OLD')
                .self::adjustment(sprintf($phaseProject, 'NEW'), '-', 'NEW'),
            ),
            self::createTrigger(
                'trg_equipment_usage_cost_delete',
                'equipment_usage',
                'DELETE',
                self::adjustment(sprintf($phaseProject, 'OLD'), '+', 'OLD'),
            ),
        ];
    }

    private static function createTrigger(
        string $name,
        string $table,
        string $event,
        string $body,
    ): string {
        return "CREATE TRIGGER {$name} AFTER {$event} ON {$table}\n"
            ."FOR EACH ROW\n"
            ."BEGIN\n"
            .$body
            ."END";
    }

    private static function adjustment(string $projectSubquery, string $operator, string $row): string
    {
        $amount = $operator === '+'
            ? 'remaining_budget + COALESCE('.$row.'.computed_cost, 0)'
            : 'remaining_budget - COALESCE('.$row.'.computed_cost, 0)';

        return "    UPDATE projects\n"
            ."    SET remaining_budget = ROUND({$amount}, 2), updated_at = CURRENT_TIMESTAMP\n"
            ."    WHERE project_id = {$projectSubquery};\n";
    }
}
