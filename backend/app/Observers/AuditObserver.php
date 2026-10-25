<?php

namespace App\Observers;

use App\Models\AuditLog;
use App\Models\EquipmentUsage;
use App\Models\LaborHourLog;
use App\Models\MaterialUsage;
use App\Models\Project;
use App\Models\ProjectPhase;
use App\Models\SiteTask;
use App\Models\WorkforceAssignment;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Throwable;

/**
 * Writes one audit_logs row for every create/update/delete on the observed
 * models. Updates store only the attributes that actually changed.
 */
class AuditObserver
{
    /**
     * Attributes that must never reach the audit trail.
     */
    private const REDACTED = [
        'password',
        'password_hash',
        'password_confirmation',
        'remember_token',
        'token',
    ];

    public function created(Model $model): void
    {
        $this->record($model, 'INSERT', null, $this->sanitize($model->getAttributes()));
    }

    public function updated(Model $model): void
    {
        $changes = Arr::except($model->getChanges(), ['updated_at']);

        if ($changes === []) {
            return;
        }

        $old = $this->sanitize(Arr::only($model->getOriginal(), array_keys($changes)));
        $new = $this->sanitize($changes);

        // Nothing reportable left (e.g. only a password hash changed).
        if ($old === [] && $new === []) {
            return;
        }

        $this->record($model, 'UPDATE', $old, $new);
    }

    public function deleted(Model $model): void
    {
        $this->record($model, 'DELETE', $this->sanitize($model->getOriginal()), null);
    }

    /**
     * @param  array<string, mixed>|null  $old
     * @param  array<string, mixed>|null  $new
     */
    private function record(Model $model, string $action, ?array $old, ?array $new): void
    {
        try {
            AuditLog::create([
                'project_id' => $this->projectId($model),
                'table_name' => $model->getTable(),
                'record_id' => (int) $model->getKey(),
                'action_type' => $action,
                'old_value' => $old,
                'new_value' => $new,
                'changed_by' => auth('sanctum')->id() ?? auth()->id(),
                'charge_at' => now(),
            ]);
        } catch (Throwable $e) {
            // Auditing must never break the business operation it records.
            report($e);
        }
    }

    private function projectId(Model $model): ?int
    {
        if ($model instanceof Project || $model instanceof ProjectPhase) {
            return $model->project_id !== null ? (int) $model->project_id : null;
        }

        if ($model instanceof SiteTask) {
            return $model->project_id !== null ? (int) $model->project_id : null;
        }

        if ($model instanceof WorkforceAssignment) {
            $projectId = $model->phase_id
                ? DB::table('project_phases')->where('phase_id', $model->phase_id)->value('project_id')
                : null;

            return $projectId !== null ? (int) $projectId : null;
        }

        // Daily site logs: resolve the owning project so the Admin can filter
        // the audit trail per site.
        if ($model instanceof MaterialUsage || $model instanceof EquipmentUsage) {
            $projectId = $model->phase_id
                ? DB::table('project_phases')->where('phase_id', $model->phase_id)->value('project_id')
                : null;

            return $projectId !== null ? (int) $projectId : null;
        }

        if ($model instanceof LaborHourLog) {
            $projectId = DB::table('workforce_assignment as wa')
                ->join('project_phases as ph', 'ph.phase_id', '=', 'wa.phase_id')
                ->where('wa.assignment_id', $model->assignment_id)
                ->value('ph.project_id');

            return $projectId !== null ? (int) $projectId : null;
        }

        return null;
    }

    /**
     * @param  array<string, mixed>  $attributes
     * @return array<string, mixed>
     */
    private function sanitize(array $attributes): array
    {
        return collect($attributes)
            ->except(self::REDACTED)
            ->map(fn (mixed $value) => $this->normalize($value))
            ->all();
    }

    private function normalize(mixed $value): mixed
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format('Y-m-d H:i:s');
        }

        return $value;
    }
}
