<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProjectPhase extends Model
{
    protected $table = 'project_phases';

    protected $primaryKey = 'phase_id';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'project_id',
        'project_name',
        'description',
        'sequence_no',
        'required_skill_id',
        'project_cost',
        'planned_start',
        'planned_end',
        'status',
        'completion_requested_at',
        'completion_requested_by',
        'created_by',
        'updated_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'planned_start' => 'date',
            'planned_end' => 'date',
            'project_cost' => 'decimal:2',
            'completion_requested_at' => 'datetime',
        ];
    }
}
