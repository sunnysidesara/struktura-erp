<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Role extends Model
{
    use HasFactory;

    /**
     * The table associated with the model.
     *
     * @var string
     */
    protected $table = 'role';

    /**
     * The primary key for the model.
     *
     * @var string
     */
    protected $primaryKey = 'role_id';

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'role_name',
        'description',
    ];

    /**
     * System role names, kept in one place so controllers/policies
     * never rely on loose string literals.
     */
    public const ADMIN = 'Admin';

    public const PROJECT_MANAGER = 'Project Manager';

    public const SITE_SUPERVISOR = 'Site Supervisor';

    /**
     * A role can be held by many accounts (role -> users, 1:M).
     */
    public function users(): HasMany
    {
        return $this->hasMany(User::class, 'role_id', 'role_id');
    }
}
