<?php

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class UpdateUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Route-level role middleware already restricts this to Admins.
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        // The user being edited is route-bound as {user}.
        $userId = $this->route('user')->user_id;

        return [
            'role_id' => ['sometimes', 'integer', Rule::exists('role', 'role_id')],
            'first_name' => ['sometimes', 'string', 'max:100'],
            'last_name' => ['sometimes', 'string', 'max:100'],
            'email' => [
                'sometimes', 'string', 'email', 'max:255',
                Rule::unique('users', 'email')->ignore($userId, 'user_id'),
            ],
            // Password is optional on update; when present it must be confirmed.
            'password' => ['sometimes', 'string', 'confirmed', Password::min(8)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }
}
