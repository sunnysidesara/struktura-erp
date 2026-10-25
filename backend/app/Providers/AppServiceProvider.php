<?php

namespace App\Providers;

use App\Models\Equipment;
use App\Models\EquipmentUsage;
use App\Models\Laborer;
use App\Models\LaborerSkill;
use App\Models\LaborHourLog;
use App\Models\Material;
use App\Models\MaterialUsage;
use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\SiteTask;
use App\Models\Skill;
use App\Models\User;
use App\Models\WorkforceAssignment;
use App\Observers\AuditObserver;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Every create/update/delete on these models writes to audit_logs.
        User::observe(AuditObserver::class);
        Skill::observe(AuditObserver::class);
        Project::observe(AuditObserver::class);
        ProjectPhase::observe(AuditObserver::class);
        WorkforceAssignment::observe(AuditObserver::class);
        // Site Supervisor daily logs (and the stock they consume).
        LaborHourLog::observe(AuditObserver::class);
        MaterialUsage::observe(AuditObserver::class);
        EquipmentUsage::observe(AuditObserver::class);
        Material::observe(AuditObserver::class);
        Equipment::observe(AuditObserver::class);
        // Labourer profiles and their trade-skill links.
        Laborer::observe(AuditObserver::class);
        LaborerSkill::observe(AuditObserver::class);
        // Site tasks shown on the supervisor schedule.
        SiteTask::observe(AuditObserver::class);
    }
}
