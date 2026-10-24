<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkforceAssignment extends Model
{
    protected $table = 'workforce_assignment';

    protected $primaryKey = 'assignment_id';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'laborer_id',
        'phase_id',
        'assigned_at',
        'role_on_task',
        'status',
        'released_at',
        'created_by',
        'updated_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'assigned_at' => 'datetime',
            'released_at' => 'datetime',
        ];
    }
}
