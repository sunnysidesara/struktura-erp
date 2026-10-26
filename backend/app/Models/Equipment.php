<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Equipment extends Model
{
    protected $table = 'equipment';

    protected $primaryKey = 'equipment_id';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'equipment_name',
        'equipment_type',
        'hourly_rental_rate',
        'equipment_status',
        'created_by',
        'updated_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'hourly_rental_rate' => 'decimal:2',
        ];
    }
}
