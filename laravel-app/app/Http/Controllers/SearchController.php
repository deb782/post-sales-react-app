<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Models\Project;
use App\Models\Unit;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __invoke(Request $request): JsonResponse
    {
        $q = trim((string) $request->get('q', ''));
        if (mb_strlen($q) < 2) {
            return response()->json(['results' => []]);
        }

        $user = $request->user();
        $isBroad = $user->hasRole('admin', 'accounts', 'management');
        $projectIds = $isBroad ? null : $user->projects()->pluck('projects.id')->all();

        $results = [];

        Project::when(! $isBroad, fn($q2) => $q2->whereIn('id', $projectIds ?? []))
            ->where('name', 'like', "%{$q}%")->limit(5)->get()
            ->each(fn($p) => $results[] = [
                'type' => 'project', 'label' => $p->name,
                'meta' => $p->city, 'url' => route('projects.index'),
            ]);

        Unit::when(! $isBroad, fn($q2) => $q2->whereIn('project_id', $projectIds ?? []))
            ->where('unit_number', 'like', "%{$q}%")->with('project')->limit(5)->get()
            ->each(fn($u) => $results[] = [
                'type' => 'unit', 'label' => $u->unit_number,
                'meta' => $u->project->name.' · '.$u->status,
                'url' => route('units.index', ['project_id' => $u->project_id]),
            ]);

        Expense::when(! $isBroad, fn($q2) => $q2->whereIn('project_id', $projectIds ?? []))
            ->where(fn($qq) => $qq->where('vendor', 'like', "%{$q}%")->orWhere('category', 'like', "%{$q}%"))
            ->limit(5)->get()
            ->each(fn($e) => $results[] = [
                'type' => 'expense', 'label' => $e->category.' · '.$e->vendor,
                'meta' => '₹'.number_format($e->amount), 'url' => route('expenses.index'),
            ]);

        if ($user->isAdmin()) {
            User::where(fn($qq) => $qq->where('name', 'like', "%{$q}%")->orWhere('email', 'like', "%{$q}%"))
                ->limit(5)->get()
                ->each(fn($u) => $results[] = [
                    'type' => 'user', 'label' => $u->name,
                    'meta' => $u->email.' · '.$u->role, 'url' => route('users.index'),
                ]);
        }

        return response()->json(['results' => $results]);
    }
}
