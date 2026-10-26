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
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Validation\Rules\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\URL;
use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Str;

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
        $this->configureSecurity();
        $this->registerAuditObservers();
    }

    /**
     * Rate limiting, password policy and transport hardening.
     */
    private function configureSecurity(): void
    {
        // Login brute-force protection: five attempts per minute and thirty
        // per hour for the same account id + IP address.
        RateLimiter::for('login', function (Request $request) {
            $key = Str::lower((string) $request->input('id_number')).'|'.$request->ip();

            return [
                Limit::perMinute(5)->by($key),
                Limit::perHour(30)->by($key),
            ];
        });

        // Baseline throttle for every authenticated endpoint (per account, or
        // per IP for anonymous requests).
        RateLimiter::for('api', function (Request $request) {
            $key = $request->user()?->user_id ?: $request->ip();

            return Limit::perMinute(120)->by((string) $key);
        });

        // A single strong password policy used by every FormRequest.
        Password::defaults(fn () => Password::min(12)
            ->letters()
            ->mixedCase()
            ->numbers()
            ->symbols());

        // Force HTTPS (and secure cookies) once the app is deployed behind TLS.
        if (app()->environment('production') || env('APP_FORCE_HTTPS', false)) {
            URL::forceScheme('https');
        }
    }

    /**
     * Every create/update/delete on these models writes to audit_logs.
     */
    private function registerAuditObservers(): void
    {
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