<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Backfill phase assignments for open task assignees.
     *
     * Done tasks are intentionally excluded: turning a historical task worker
     * into an active assignment would overstate the site's current workforce.
     * New and edited tasks are kept in sync by TaskController.
     */
    public function up(): void
    {
        if (! Schema::hasTable('site_task') || ! Schema::hasTable('workforce_assignment')) {
            return;
        }

        $rows = DB::table('site_task as t')
            ->join('project_phases as ph', 'ph.phase_id', '=', 't.phase_id')
            ->join('laborer as l', 'l.laborer_id', '=', 't.assigned_laborer_id')
            ->leftJoin('workforce_assignment as wa', function ($join) {
                $join->on('wa.laborer_id', '=', 't.assigned_laborer_id')
                    ->on('wa.phase_id', '=', 't.phase_id')
                    ->where('wa.status', '=', 'Active');
            })
            ->whereIn('t.status', ['Pending', 'In Progress'])
            ->where('l.employment_status', 'Active')
            ->whereNull('wa.assignment_id')
            ->select(
                't.assigned_laborer_id',
                't.phase_id',
                't.created_by',
                't.updated_by'
            )
            ->get();

        $now = now();

        foreach ($rows as $row) {
            DB::table('workforce_assignment')->insert([
                'laborer_id' => $row->assigned_laborer_id,
                'phase_id' => $row->phase_id,
                'assigned_at' => $now,
                'role_on_task' => null,
                'status' => 'Active',
                'hourly_rate_ovveride' => null,
                'released_at' => null,
                'created_by' => $row->created_by,
                'created_at' => $now,
                'updated_by' => $row->updated_by ?? $row->created_by,
                'updated_at' => $now,
            ]);
        }
    }

    /**
     * This is a data repair; there is no safe way to identify which
     * assignments were created by the migration after the fact.
     */
    public function down(): void
    {
        //
    }
};
