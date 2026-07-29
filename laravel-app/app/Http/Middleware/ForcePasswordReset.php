<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ForcePasswordReset
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && $user->must_reset_password
            && ! $request->routeIs('password.reset', 'password.update', 'logout')) {
            return redirect()->route('password.reset');
        }
        return $next($request);
    }
}
