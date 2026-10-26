<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Adds browser-side hardening headers to every response and keeps API
 * payloads out of shared caches.
 *
 * - nosniff blocks MIME confusion (e.g. a JSON error rendered as HTML).
 * - DENY stops the API/UI being framed (clickjacking).
 * - no-referrer keeps tokens/IDs out of the Referer header.
 * - a strict CSP on /api/* means a JSON response can never execute script.
 * - HSTS is only sent when the request actually arrived over HTTPS in
 *   production, so local HTTP development keeps working.
 */
class SecurityHeaders
{
    public function handle(Request $request, Closure $next): Response
    {
        /** @var Response $response */
        $response = $next($request);

        $headers = $response->headers;

        $headers->set('X-Content-Type-Options', 'nosniff');
        $headers->set('X-Frame-Options', 'DENY');
        $headers->set('Referrer-Policy', 'no-referrer');
        $headers->set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
        $headers->set('Cross-Origin-Opener-Policy', 'same-origin');
        $headers->set('Cross-Origin-Resource-Policy', 'same-site');

        // Never advertise the runtime or framework version.
        $headers->remove('X-Powered-By');
        $headers->remove('X-AspNet-Version');

        // PHP's SAPI appends X-Powered-By after the response object is built.
        if (function_exists('header_remove')) {
            header_remove('X-Powered-By');
        }

        if ($request->is('api/*')) {
            $headers->set(
                'Content-Security-Policy',
                "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
            );
            // Tokens, personal data and cost figures must never be cached by
            // a proxy or a shared browser.
            $headers->set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            $headers->set('Pragma', 'no-cache');
        }

        if ($this->shouldSendHsts($request)) {
            $headers->set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        }

        return $response;
    }

    private function shouldSendHsts(Request $request): bool
    {
        return app()->environment('production')
            && ($request->secure() || $request->header('X-Forwarded-Proto') === 'https');
    }
}