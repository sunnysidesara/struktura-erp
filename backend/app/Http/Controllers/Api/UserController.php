<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\User\StoreUserRequest;
use App\Http\Requests\User\UpdateUserRequest;
use App\Models\Role;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class UserController extends Controller
{
    /**
     * List all user accounts with their roles.
     */
    public function index(Request $request): JsonResponse
    {
        $query = User::with('role');

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('role_id')) {
            $query->where('role_id', $request->query('role_id'));
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Most recent successful sign-in per account (Overview "Last Login").
        $lastLogins = DB::table('login_history')
            ->select('user_id', DB::raw('MAX(created_at) as last_login_at'))
            ->where('status', 'success')
            ->whereNotNull('user_id')
            ->groupBy('user_id')
            ->pluck('last_login_at', 'user_id');

        return response()->json([
            'data' => $query->orderBy('user_id')->get()->map(fn (User $u) => $this->payload($u) + [
                'last_login_at' => isset($lastLogins[$u->user_id])
                    ? Carbon::parse($lastLogins[$u->user_id])->toIso8601String()
                    : null,
            ]),
        ]);
    }

    /**
     * Create a new user account.
     */
    public function store(StoreUserRequest $request): JsonResponse
    {
        $data = $request->validated();

        $role = Role::findOrFail($data['role_id']);
        $idNumber = $data['id_number'] ?? $this->nextIdNumber($role);

        $user = User::create([
            'id_number' => $idNumber,
            'role_id' => $data['role_id'],
            'first_name' => $data['first_name'],
            'last_name' => $data['last_name'],
            'email' => $data['email'],
            'contact_number' => $data['contact_number'] ?? null,
            // Cast 'hashed' on the model hashes this automatically.
            'password_hash' => $data['password'],
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json([
            'message' => 'User created successfully.',
            'data' => $this->payload($user->load('role')),
        ], 201);
    }

    /**
     * Show a single user account.
     */
    public function show(User $user): JsonResponse
    {
        return response()->json([
            'data' => $this->payload($user->load('role')),
        ]);
    }

    /**
     * Update an existing user account (including role reassignment).
     */
    public function update(UpdateUserRequest $request, User $user): JsonResponse
    {
        $data = $request->validated();

        if (array_key_exists('password', $data)) {
            $data['password_hash'] = $data['password'];
            unset($data['password']);
        }

        $user->update($data);

        return response()->json([
            'message' => 'User updated successfully.',
            'data' => $this->payload($user->fresh()->load('role')),
        ]);
    }

    /**
     * Deactivate a user account.
     *
     * Accounts are deactivated rather than deleted to preserve the
     * created_by/updated_by history they may be referenced by. Only
     * Admins reach this endpoint (route middleware).
     */
    public function deactivate(Request $request, User $user): JsonResponse
    {
        if ($request->user()->user_id === $user->user_id) {
            return response()->json([
                'message' => 'You cannot deactivate your own account.',
            ], 422);
        }

        $user->update(['is_active' => false]);
        // Invalidate any active sessions for the deactivated account.
        $user->tokens()->delete();

        return response()->json([
            'message' => 'User deactivated successfully.',
            'data' => $this->payload($user->fresh()->load('role')),
        ]);
    }

    /**
     * Reactivate a previously deactivated account.
     */
    public function activate(User $user): JsonResponse
    {
        $user->update(['is_active' => true]);

        return response()->json([
            'message' => 'User activated successfully.',
            'data' => $this->payload($user->fresh()->load('role')),
        ]);
    }

    /**
     * Shape a user record for API responses (never exposes the hash).
     *
     * @return array<string, mixed>
     */
    private function payload(User $user): array
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
            'role_id' => $user->role_id,
            'role_name' => $user->role?->role_name,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];
    }

    /**
     * Build the next account ID for a role.
     *
     * Format: <prefix><role-code><4-digit serial>, e.g. SYS010001 / PM020001 / SUP030001.
     */
    private function nextIdNumber(Role $role): string
    {
        [$prefix, $roleCode] = match ($role->role_name) {
            Role::ADMIN => ['SYS', '01'],
            Role::PROJECT_MANAGER => ['PM', '02'],
            Role::SITE_SUPERVISOR => ['SUP', '03'],
            default => throw ValidationException::withMessages([
                'role_id' => ['This role cannot be assigned an account ID.'],
            ]),
        };

        $stem = $prefix.$roleCode;
        $maxSerial = 0;

        foreach (User::where('id_number', 'like', $stem.'%')->pluck('id_number') as $existingId) {
            $maxSerial = max($maxSerial, (int) substr((string) $existingId, strlen($stem)));
        }

        return $stem.str_pad((string) ($maxSerial + 1), 4, '0', STR_PAD_LEFT);
    }
}
