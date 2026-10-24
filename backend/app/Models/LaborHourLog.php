<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LaborHourLog extends Model
{
    protected $table = 'labor_hour_log';

    protected $primaryKey = 'log_id';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'assignment_id',
        'log_date',
        'shift',
        'time_in',
        'time_out',
        'regular_hours',
        'overtime_hours',
        'computed_cost',
        'created_by',
        'created_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'log_date' => 'date',
            'created_at' => 'datetime',
        ];
    }
}
