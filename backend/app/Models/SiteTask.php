<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SiteTask extends Model
{
    protected $table = 'site_task';

    protected $primaryKey = 'task_id';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'project_id',
        'phase_id',
        'title',
        'task_date',
        'start_time',
        'assigned_laborer_id',
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
            'task_date' => 'date:Y-m-d',
        ];
    }
}
