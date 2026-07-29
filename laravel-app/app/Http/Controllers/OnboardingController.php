<?php

namespace App\Http\Controllers;

use App\Models\Project;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\View\View;

class OnboardingController extends Controller
{
    public function index(Request $request): View
    {
        $step = (int) $request->get('step', 1);
        $step = max(1, min(3, $step));

        $projects = Project::orderBy('created_at')->get();
        $teamCount = User::whereIn('role', ['accounts', 'management', 'site_manager'])->where('is_active', true)->count();

        return view('onboarding', compact('step', 'projects', 'teamCount'));
    }

    public function complete(Request $request): RedirectResponse
    {
        $request->user()->update(['onboarding_completed' => true]);
        return redirect()->route('dashboard')->with('status', 'Onboarding complete. Welcome aboard!');
    }
}
