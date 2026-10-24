<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class EquipmentUsage extends Model
{
    protected $table = 'equipment_usage';

    protected $primaryKey = 'equipment_usage_id';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'equipment_id',
        'phase_id',
        'usage_date',
        'hours_used',
        'computed_cost',
        'created_by',
        'updated_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'usage_date' => 'date',
        ];
    }
}
