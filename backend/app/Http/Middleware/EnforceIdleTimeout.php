<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

/**
 * Sliding idle timeout for Sanctum personal access tokens.
 *
 * This middleware is registered on the GLOBAL stack because Laravel's
 * middleware priority runs `auth:sanctum` before custom route middleware, and
 * Sanctum refreshes `last_used_at` while authenticating. Running here means
 * we still see the previous activity time.
 */
class EnforceIdleTimeout
{
    public function handle(Request $request, Closure $next): Response
    {
        $idleMinutes = (int) config('sanctum.idle_timeout', 30);

        if ($idleMinutes <= 0) {
            return $next($request);
        }

        $bearer = $request->bearerToken();

        if (! $bearer || ! str_contains($bearer, '|')) {
            return $next($request);
        }

        [$id, $plain] = explode('|', $bearer, 2);

        if (! ctype_digit($id)) {
            return $next($request);
        }

        $token = DB::table('personal_access_tokens')->where('id', (int) $id)->first();

        if (! $token) {
            return $next($request);
        }

        // Constant-time comparison against the stored hash.
        if (! hash_equals((string) $token->token, hash('sha256', $plain))) {
            return $next($request);
        }

        $lastSeen = $token->last_used_at ?? $token->created_at;

        if ($lastSeen === null) {
            return $next($request);
        }

        $idleSeconds = now()->getTimestamp() - Carbon::parse($lastSeen)->getTimestamp();

        if ($idleSeconds >= $idleMinutes * 60) {
            DB::table('personal_access_tokens')->where('id', (int) $id)->delete();

            return response()->json([
                'message' => 'Your session expired due to inactivity. Please sign in again.',
                'reason' => 'idle_timeout',
            ], 401);
        }

        return $next($request);
    }
}