<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class MaterialUsage extends Model
{
    protected $table = 'material_usage';

    protected $primaryKey = 'material_usage_id';

    /**
     * @var list<string>
     */
    protected $fillable = [
        'material_id',
        'phase_id',
        'usage_date',
        'quantity_used',
        'unit_cost_at_use',
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
            'unit_cost_at_use' => 'decimal:6',
        ];
    }
}
