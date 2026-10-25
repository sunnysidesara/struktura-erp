<?php

use App\Http\Controllers\Api\AdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\LaborerController;
use App\Http\Controllers\Api\PmController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\SkillController;
use App\Http\Controllers\Api\SsController;
use App\Http\Controllers\Api\TaskController;
use App\Http\Controllers\Api\UserController;
use App\Models\Role;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Stateless JSON API consumed by the Next.js frontend. Authentication is
| via Sanctum bearer tokens.
|
*/

Route::prefix('v1')->group(function () {
    // ---- Public ----
    Route::post('/login', [AuthController::class, 'login']);

    // ---- Authenticated ----
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/me', [AuthController::class, 'me']);
        // Self-service account settings (profile + password).
        Route::match(['put', 'patch'], '/me', [AuthController::class, 'updateProfile']);
        Route::post('/me/password', [AuthController::class, 'changePassword']);
        Route::post('/me/logout-all', [AuthController::class, 'logoutAll']);
        Route::get('/me/logins', [AuthController::class, 'loginHistory']);
        Route::get('/me/notifications', [AuthController::class, 'notifications']);
        Route::post('/logout', [AuthController::class, 'logout']);

        // Roles are read-only system data; any authenticated user may list them.
        Route::get('/roles', [RoleController::class, 'index']);

        // User & Role Management — Admin only.
        Route::middleware('role:'.Role::ADMIN)->group(function () {
            Route::get('/users', [UserController::class, 'index']);
            Route::post('/users', [UserController::class, 'store']);
            Route::get('/users/{user}', [UserController::class, 'show']);
            Route::match(['put', 'patch'], '/users/{user}', [UserController::class, 'update']);
            Route::patch('/users/{user}/deactivate', [UserController::class, 'deactivate']);
            Route::patch('/users/{user}/activate', [UserController::class, 'activate']);

            // System Administrator console data.
            Route::get('/admin/dashboard', [AdminController::class, 'dashboard']);
            Route::get('/admin/projects', [AdminController::class, 'projects']);
            Route::get('/admin/phases', [AdminController::class, 'phases']);
            Route::get('/admin/assignments', [AdminController::class, 'assignments']);
            Route::get('/admin/resources', [AdminController::class, 'resources']);
            Route::post('/admin/materials', [AdminController::class, 'storeMaterial']);
            Route::put('/admin/materials/{material}', [AdminController::class, 'updateMaterial']);
            Route::delete('/admin/materials/{material}', [AdminController::class, 'destroyMaterial']);
            Route::post('/admin/equipment', [AdminController::class, 'storeEquipment']);
            Route::put('/admin/equipment/{equipment}', [AdminController::class, 'updateEquipment']);
            Route::patch('/admin/equipment/{equipment}/status', [AdminController::class, 'changeEquipmentStatus']);
            Route::delete('/admin/equipment/{equipment}', [AdminController::class, 'destroyEquipment']);
            Route::get('/admin/audit/events', [AdminController::class, 'auditEvents']);
            Route::get('/admin/audit/logins', [AdminController::class, 'auditLogins']);
            Route::get('/admin/search', [AdminController::class, 'search']);

            // Skill catalog (system reference data).
            Route::get('/skills', [SkillController::class, 'index']);
            Route::post('/skills', [SkillController::class, 'store']);
            Route::put('/skills/{skill}', [SkillController::class, 'update']);
            Route::delete('/skills/{skill}', [SkillController::class, 'destroy']);
        });

        // Project Manager console (Admin has read-only oversight).
        Route::middleware('role:'.Role::ADMIN.','.Role::PROJECT_MANAGER)->group(function () {
            Route::get('/pm/dashboard', [PmController::class, 'dashboard']);
            Route::get('/pm/projects', [PmController::class, 'projects']);
            Route::get('/pm/phases', [PmController::class, 'phases']);
            Route::get('/pm/tasks', [TaskController::class, 'index']);
            Route::get('/pm/workforce', [PmController::class, 'workforce']);
            Route::get('/pm/laborers', [LaborerController::class, 'index']);
            Route::get('/pm/laborers/{laborer}', [LaborerController::class, 'show']);
            Route::get('/pm/skill-match', [PmController::class, 'skillMatch']);
            Route::get('/pm/materials', [PmController::class, 'materials']);
            Route::get('/pm/equipment', [PmController::class, 'equipment']);
            Route::get('/pm/assignments', [PmController::class, 'assignments']);
            Route::get('/pm/budgets', [PmController::class, 'budgets']);
            Route::get('/pm/cost-report', [PmController::class, 'costReport']);
            Route::get('/pm/phase-costs', [PmController::class, 'phaseCosts']);
            Route::get('/pm/balance', [PmController::class, 'balance']);
            Route::get('/pm/search', [PmController::class, 'search']);
            Route::get('/pm/skills', [PmController::class, 'skills']);
            Route::get('/pm/site-supervisors', [PmController::class, 'siteSupervisors']);
            Route::get('/pm/material-catalog', [PmController::class, 'materialCatalog']);
            Route::get('/pm/equipment-catalog', [PmController::class, 'equipmentCatalog']);
            Route::get('/pm/material-usage', [PmController::class, 'materialUsage']);
            Route::get('/pm/equipment-usage', [PmController::class, 'equipmentUsage']);

            // Only a Project Manager may create/edit their own projects, phases,
            // laborers and assignments — the Admin has view-only oversight.
            Route::middleware('role:'.Role::PROJECT_MANAGER)->group(function () {
                Route::post('/pm/laborers', [LaborerController::class, 'store']);
                Route::put('/pm/laborers/{laborer}', [LaborerController::class, 'update']);
                Route::delete('/pm/laborers/{laborer}', [LaborerController::class, 'destroy']);
                Route::post('/pm/laborers/{laborer}/skills', [LaborerController::class, 'attachSkill']);
                Route::delete('/pm/laborers/{laborer}/skills/{skill}', [LaborerController::class, 'detachSkill']);
                Route::patch('/pm/laborers/{laborer}/status', [LaborerController::class, 'changeStatus']);
                Route::post('/pm/projects', [PmController::class, 'storeProject']);
                Route::put('/pm/projects/{project}', [PmController::class, 'updateProject']);
                Route::patch('/pm/projects/{project}/status', [PmController::class, 'changeProjectStatus']);
                Route::post('/pm/phases', [PmController::class, 'storePhase']);
                Route::put('/pm/phases/{phase}', [PmController::class, 'updatePhase']);
                Route::patch('/pm/phases/{phase}/start', [PmController::class, 'startPhase']);
                Route::patch('/pm/phases/{phase}/approve-completion', [PmController::class, 'approvePhaseCompletion']);
                Route::patch('/pm/phases/{phase}/reject-completion', [PmController::class, 'rejectPhaseCompletion']);
                Route::delete('/pm/phases/{phase}', [PmController::class, 'destroyPhase']);
                Route::post('/pm/tasks', [TaskController::class, 'store']);
                Route::put('/pm/tasks/{task}', [TaskController::class, 'update']);
                Route::put('/pm/tasks/{task}/status', [TaskController::class, 'updateStatus']);
                Route::delete('/pm/tasks/{task}', [TaskController::class, 'destroy']);
                Route::post('/pm/assignments', [PmController::class, 'storeAssignment']);
                Route::delete('/pm/assignments/{assignment}', [PmController::class, 'destroyAssignment']);
                Route::post('/pm/material-usage', [PmController::class, 'storeMaterialUsage']);
                Route::delete('/pm/material-usage/{id}', [PmController::class, 'destroyMaterialUsage']);
                Route::post('/pm/equipment-usage', [PmController::class, 'storeEquipmentUsage']);
                Route::delete('/pm/equipment-usage/{id}', [PmController::class, 'destroyEquipmentUsage']);
            });
        });

        // Site Supervisor console: Admin and Site Supervisor can read everything,
        // but only a Site Supervisor may record labor/material/equipment usage.
        Route::middleware('role:'.Role::ADMIN.','.Role::SITE_SUPERVISOR)->group(function () {
            Route::get('/ss/dashboard', [SsController::class, 'dashboard']);
            Route::get('/ss/site', [SsController::class, 'site']);
            Route::get('/ss/site/info', [SsController::class, 'siteInfo']);
            Route::get('/ss/schedule', [SsController::class, 'schedule']);
            Route::get('/ss/log-hours', [SsController::class, 'logHours']);
            Route::get('/ss/materials', [SsController::class, 'materials']);
            Route::get('/ss/equipment', [SsController::class, 'equipment']);
            Route::get('/ss/workers', [SsController::class, 'workers']);
            Route::get('/ss/phases', [SsController::class, 'phases']);
            Route::get('/ss/search', [SsController::class, 'search']);
            Route::get('/ss/sites', [SsController::class, 'sites']);

            Route::middleware('role:'.Role::SITE_SUPERVISOR)->group(function () {
                Route::post('/ss/log-hours', [SsController::class, 'storeLaborLog']);
                Route::put('/ss/log-hours/{id}', [SsController::class, 'updateLaborLog']);
                Route::delete('/ss/log-hours/{id}', [SsController::class, 'destroyLaborLog']);
                Route::post('/ss/materials', [SsController::class, 'storeMaterialUsage']);
                Route::put('/ss/materials/{id}', [SsController::class, 'updateMaterialUsage']);
                Route::delete('/ss/materials/{id}', [SsController::class, 'destroyMaterialUsage']);
                Route::post('/ss/equipment', [SsController::class, 'storeEquipmentUsage']);
                Route::put('/ss/equipment/{id}', [SsController::class, 'updateEquipmentUsage']);
                Route::delete('/ss/equipment/{id}', [SsController::class, 'destroyEquipmentUsage']);
                Route::put('/ss/tasks/{task}/status', [TaskController::class, 'updateStatus']);
                Route::post('/ss/phases/{id}/request-completion', [SsController::class, 'requestCompletion']);
            });
        });
    });
});
