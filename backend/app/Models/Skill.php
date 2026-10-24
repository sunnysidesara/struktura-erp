<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Skill extends Model
{
    protected $table = 'skill';

    protected $primaryKey = 'skill_id';

    /** The skill catalog has no timestamp columns. */
    public $timestamps = false;

    /**
     * @var list<string>
     */
    protected $fillable = [
        'skill_name',
        'description',
        'category',
    ];
}
