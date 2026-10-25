<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Laborer extends Model
{
    protected $table = 'laborer';

    protected $primaryKey = 'laborer_id';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'first_name',
        'last_name',
        'hourly_rate',
        'employment_status',
        'contact_number',
        'date_hired',
        'created_by',
        'updated_by',
    ];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'hourly_rate' => 'decimal:2',
            'date_hired' => 'date:Y-m-d',
        ];
    }
}
