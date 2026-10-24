<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Project extends Model
{
    protected $table = 'projects';

    protected $primaryKey = 'project_id';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'project_name',
        'client_id',
        'user_id',
        'site_supervisor_id',
        'client_name',
        'location',
        'latitude',
        'longitude',
        'start_date',
        'end_date',
        'approved_budget',
        'materials_budget',
        'equipment_budget',
        'remaining_budget',
        'deadline',
        'status',
        'created_by',
        'updated_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'deadline' => 'date',
            'approved_budget' => 'decimal:2',
            'remaining_budget' => 'decimal:2',
        ];
    }
}
