<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ChangePasswordRequest;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\User\UpdateProfileRequest;
use App\Models\LoginHistory;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AuthController extends Controller
{
    /**
     * Authenticate a user and issue a Sanctum API token.
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = $request->validated();

        /** @var User|null $user */
        $user = User::with('role')->where('id_number', $credentials['id_number'])->first();

        // Use a single, generic error to avoid leaking which field was wrong.
        if (! $user || ! Hash::check($credentials['password'], $user->password_hash)) {
            $this->recordLoginAttempt($request, $user, 'failed');

            throw ValidationException::withMessages([
                'id_number' => ['The provided credentials are incorrect.'],
            ]);
        }

        if (! $user->is_active) {
            $this->recordLoginAttempt($request, $user, 'failed');

            throw ValidationException::withMessages([
                'id_number' => ['The provided credentials are incorrect.'],
            ]);
        }

        // Keep existing tokens so a second tab or device has its own session.
        // Explicit sign-out-everywhere and password changes still revoke them.
        $token = $user->createToken('api')->plainTextToken;

        $this->recordLoginAttempt($request, $user, 'success');

        return response()->json([
            'message' => 'Logged in successfully.',
            'token' => $token,
            'user' => $this->userPayload($user),
        ]);
    }

    /**
     * Return the currently authenticated user.
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json([
            'user' => $this->userPayload($request->user()->load('role')),
        ]);
    }

    /**
     * Revoke the current access token (log out).
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully.']);
    }

    /**
     * The three most recent audit events relevant to the signed-in account.
     */
    public function notifications(Request $request): JsonResponse
    {
        $user = $request->user()->load('role');
        $roleName = $user->role?->role_name;

        $query = DB::table('audit_logs as a')
            ->leftJoin('projects as p', 'p.project_id', '=', 'a.project_id')
            ->leftJoin('users as u', 'u.user_id', '=', 'a.changed_by')
            ->orderByDesc('a.charge_at')
            ->orderByDesc('a.audit_log_id')
            ->limit(3);

        // Admins see every event; PMs and Site Supervisors see activity from
        // their own projects plus anything they did themselves.
        if ($roleName === Role::PROJECT_MANAGER) {
            $query->where(fn ($scoped) => $scoped
                ->where('p.user_id', $user->user_id)
                ->orWhere('a.changed_by', $user->user_id));
        } elseif ($roleName === Role::SITE_SUPERVISOR) {
            $query->where(fn ($scoped) => $scoped
                ->where('p.site_supervisor_id', $user->user_id)
                ->orWhere('a.changed_by', $user->user_id));
        }

        $rows = $query->get([
            'a.audit_log_id as id',
            'a.action_type as action',
            'a.table_name as table_name',
            'a.record_id as record_id',
            'a.old_value as old_value',
            'a.new_value as new_value',
            'a.charge_at as charge_at',
            'p.project_name as project_name',
            'u.id_number as actor_id_number',
            'u.first_name as actor_first_name',
            'u.last_name as actor_last_name',
        ]);

        $notifications = $rows->map(function ($row) {
            $payload = json_decode((string) ($row->new_value ?? $row->old_value), true);
            $actorName = trim(($row->actor_first_name ?? '').' '.($row->actor_last_name ?? ''));

            $actor = null;

            if ($row->actor_id_number) {
                $actor = $actorName !== ''
                    ? $row->actor_id_number.' - '.$actorName
                    : $row->actor_id_number;
            }

            return [
                'id' => (int) $row->id,
                'action' => $row->action,
                'table_name' => $row->table_name,
                'record_id' => (int) $row->record_id,
                'changed_fields' => is_array($payload) ? array_keys($payload) : [],
                'project_name' => $row->project_name,
                'actor' => $actor,
                'created_at' => $row->charge_at
                    ? Carbon::parse($row->charge_at)->toIso8601String()
                    : null,
            ];
        });

        return response()->json(['data' => $notifications]);
    }

    /**
     * Sign out of every device by revoking all of the account's tokens.
     */
    public function logoutAll(Request $request): JsonResponse
    {
        $request->user()->tokens()->delete();

        return response()->json(['message' => 'Signed out of all devices.']);
    }

    /**
     * Update the authenticated account's own profile details.
     */
    public function updateProfile(UpdateProfileRequest $request): JsonResponse
    {
        $user = $request->user();
        $user->update($request->validated());

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user' => $this->userPayload($user->fresh()->load('role')),
        ]);
    }

    /**
     * Change the authenticated account's password.
     *
     * The token used for this request stays valid; every other device is
     * signed out (their tokens are revoked).
     */
    public function changePassword(ChangePasswordRequest $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validated();

        if (! Hash::check($data['current_password'], $user->password_hash)) {
            throw ValidationException::withMessages([
                'current_password' => ['The current password is incorrect.'],
            ]);
        }

        $user->update(['password_hash' => $data['password']]);

        $token = $user->currentAccessToken();
        $currentTokenId = $token instanceof PersonalAccessToken ? $token->id : null;

        $user->tokens()
            ->when($currentTokenId !== null, fn ($query) => $query->whereKeyNot($currentTokenId))
            ->delete();

        return response()->json(['message' => 'Password changed successfully.']);
    }

    /**
     * Return this account's login attempts, newest first (Profile page).
     */
    public function loginHistory(Request $request): JsonResponse
    {
        $attempts = $request->user()
            ->loginHistories()
            ->latest('created_at')
            ->limit(10)
            ->get()
            ->map(fn (LoginHistory $attempt) => [
                'id' => $attempt->id,
                'ip_address' => $attempt->ip_address,
                'user_agent' => $attempt->user_agent,
                'status' => $attempt->status,
                'created_at' => $attempt->created_at?->toIso8601String(),
            ]);

        return response()->json(['data' => $attempts]);
    }

    /**
     * Persist a login attempt. `$user` is null when the account ID is unknown.
     */
    private function recordLoginAttempt(Request $request, ?User $user, string $status): void
    {
        LoginHistory::create([
            'user_id' => $user?->user_id,
            'ip_address' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 255, ''),
            'status' => $status,
            'created_at' => now(),
        ]);
    }

    /**
     * Shape the user payload returned to the client.
     *
     * @return array<string, mixed>
     */
    private function userPayload(User $user): array
    {
        return [
            'user_id' => $user->user_id,
            'id_number' => $user->id_number,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'full_name' => $user->full_name,
            'email' => $user->email,
            'contact_number' => $user->contact_number,
            'is_active' => $user->is_active,
            'created_at' => $user->created_at?->toIso8601String(),
            'role' => [
                'role_id' => $user->role?->role_id,
                'role_name' => $user->role?->role_name,
            ],
        ];
    }
}
