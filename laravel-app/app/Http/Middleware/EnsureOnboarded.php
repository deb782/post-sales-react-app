<?php

namespace App\Http\Middleware;

use App\Models\Project;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOnboarded
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && $user->isAdmin() && ! $user->onboarding_completed) {
            $hasProject = Project::exists();
            if (! $hasProject && ! $request->routeIs('onboarding.*')) {
                return redirect()->route('onboarding.index');
            }
        }
        return $next($request);
    }
}
