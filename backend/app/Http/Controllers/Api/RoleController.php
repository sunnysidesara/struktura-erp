<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use Illuminate\Http\JsonResponse;

class RoleController extends Controller
{
    /**
     * List the fixed set of roles (for assignment dropdowns, etc.).
     */
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Role::orderBy('role_id')->get([
                'role_id',
                'role_name',
                'description',
            ]),
        ]);
    }
}
