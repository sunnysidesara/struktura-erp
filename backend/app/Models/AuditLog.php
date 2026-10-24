<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditLog extends Model
{
    protected $table = 'audit_logs';

    protected $primaryKey = 'audit_log_id';

    /** Rows only carry a charge_at timestamp. */
    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'project_id',
        'table_name',
        'record_id',
        'action_type',
        'old_value',
        'new_value',
        'changed_by',
        'charge_at',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'old_value' => 'array',
            'new_value' => 'array',
            'charge_at' => 'datetime',
        ];
    }
}
