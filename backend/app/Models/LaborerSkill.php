<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LaborerSkill extends Model
{
    protected $table = 'laborer_skills';

    protected $primaryKey = 'laborer_skill_id';

    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'laborer_id',
        'skill_id',
        'skill_name',
        'proficiency_level',
        'years_experience',
        'date_certified',
        'created_by',
        'updated_by',
    ];
}
