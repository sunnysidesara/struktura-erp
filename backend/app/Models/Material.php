<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Material extends Model
{
    protected $table = 'materials';

    protected $primaryKey = 'material_id';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'material_name',
        'unit_of_measure',
        'unit_cost',
        'stock_quantity',
        'supplier_name',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'unit_cost' => 'decimal:2',
        ];
    }
}
