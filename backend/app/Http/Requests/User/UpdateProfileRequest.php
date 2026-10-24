<?php

namespace App\Http\Requests\User;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProfileRequest extends FormRequest
{
    public function authorize(): bool
    {
        // Any authenticated user may update their own profile.
        return true;
    }

    /**
     * Normalize input so stray whitespace or a capitalized email cannot
     * slip past the uniqueness check.
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

        if ($this->has('contact_number')) {
            $contact = $this->input('contact_number');

            if (is_string($contact)) {
                // Store digits only: users often paste "+63 917-123-4567".
                $digits = preg_replace('/[\s\-().]+/', '', trim($contact));
                $normalized['contact_number'] = $digits === '' ? null : $digits;
            } elseif ($contact === null) {
                $normalized['contact_number'] = null;
            }
        }

        $this->merge($normalized);
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $userId = $this->user()?->user_id;

        return [
            'first_name' => ['required', 'string', 'max:100', 'regex:/^[\pL][\pL\s.\'-]*$/u'],
            'last_name' => ['required', 'string', 'max:100', 'regex:/^[\pL][\pL\s.\'-]*$/u'],
            'email' => [
                'required', 'string', 'email:rfc', 'max:255',
                Rule::unique('users', 'email')->ignore($userId, 'user_id'),
            ],
            'contact_number' => ['nullable', 'string', 'max:16', 'regex:/^\+?[0-9]{7,15}$/'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'first_name.regex' => 'The first name may only contain letters, spaces, hyphens, apostrophes, and periods.',
            'last_name.regex' => 'The last name may only contain letters, spaces, hyphens, apostrophes, and periods.',
            'email.unique' => 'An account with this email already exists.',
            'contact_number.regex' => 'The contact number must be numeric: 7 to 15 digits, with an optional leading +.',
        ];
    }
}
