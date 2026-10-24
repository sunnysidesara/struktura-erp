<?php

namespace App\Http\Requests\User;

use App\Models\Role;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;

class StoreUserRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Route-level role middleware already restricts this to Admins.
        return true;
    }

    /**
     * Normalize input before validation so trailing spaces or a capitalized
     * email can never trip the uniqueness rule.
     */
    protected function prepareForValidation(): void
    {
        $normalized = [];

        foreach (['first_name', 'last_name'] as $field) {
            $value = $this->input($field);

            if (is_string($value)) {
                $normalized[$field] = trim($value);
            }
        }

        $email = $this->input('email');

        if (is_string($email)) {
            $normalized['email'] = mb_strtolower(trim($email));
        }

        $this->merge($normalized);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            'id_number' => ['sometimes', 'string', 'max:20', 'unique:users,id_number'],
            'role_id' => [
                'required',
                'integer',
                Rule::exists('role', 'role_id')->where(
                    fn ($query) => $query->whereIn('role_name', [
                        Role::ADMIN,
                        Role::PROJECT_MANAGER,
                        Role::SITE_SUPERVISOR,
                    ])
                ),
            ],
            'first_name' => ['required', 'string', 'max:100', 'regex:/^[\pL][\pL\s.\'-]*$/u'],
            'last_name' => ['required', 'string', 'max:100', 'regex:/^[\pL][\pL\s.\'-]*$/u'],
            'email' => ['required', 'string', 'email:rfc', 'max:255', 'unique:users,email'],
            'contact_number' => ['sometimes', 'nullable', 'string', 'max:30', 'regex:/^[0-9+()\s.-]*$/'],
            'password' => ['required', 'string', 'confirmed', Password::min(8)],
            'is_active' => ['sometimes', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'role_id.exists' => 'Choose one of the system roles: System Administrator, Project Manager, or Site Supervisor.',
            'first_name.regex' => 'The first name may only contain letters, spaces, hyphens, apostrophes, and periods.',
            'last_name.regex' => 'The last name may only contain letters, spaces, hyphens, apostrophes, and periods.',
            'email.unique' => 'An account with this email already exists.',
        ];
    }
}
