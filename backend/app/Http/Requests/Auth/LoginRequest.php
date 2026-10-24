<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        return [
            // Account ID only (e.g. SYS010001, PM020001, SUP030001) — never email.
            'id_number' => ['required', 'string', 'max:20'],
            'password' => ['required', 'string'],
        ];
    }
}
