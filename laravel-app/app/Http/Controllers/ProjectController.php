<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\Project;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\View\View;

class ProjectController extends Controller
{
    public function index(): View
    {
        $projects = Project::withCount('units')->orderBy('created_at', 'desc')->get();
        return view('projects.index', compact('projects'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateProject($request);
        $data['image_path'] = $this->handleImage($request);

        $project = Project::create($data);
        AuditLog::create([
            'actor_id' => auth()->id(),
            'actor_role' => auth()->user()->role,
            'action' => 'project.create',
            'entity_type' => 'project',
            'entity_id' => $project->id,
            'meta' => ['name' => $project->name],
            'created_at' => now(),
        ]);

        return back()->with('status', "Project “{$project->name}” created.");
    }

    public function update(Request $request, Project $project): RedirectResponse
    {
        $data = $this->validateProject($request, $project->id);
        if ($request->hasFile('image')) {
            $data['image_path'] = $this->handleImage($request);
        }
        $project->update($data);
        return back()->with('status', 'Project updated.');
    }

    public function destroy(Project $project): RedirectResponse
    {
        $project->delete();
        return redirect()->route('projects.index')->with('status', 'Project deleted.');
    }

    public function impact(Project $project)
    {
        return response()->json([
            'units' => $project->units()->count(),
            'payments' => $project->payments()->count(),
            'expenses' => $project->expenses()->count(),
            'users' => $project->users()->count(),
        ]);
    }

    private function validateProject(Request $request, ?int $id = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'project_type' => ['required', 'in:residential,commercial,plot,villa,mixed'],
            'developer' => ['nullable', 'string', 'max:120'],
            'address' => ['nullable', 'string', 'max:255'],
            'city' => ['nullable', 'string', 'max:80'],
            'state' => ['nullable', 'string', 'max:80'],
            'pincode' => ['nullable', 'string', 'max:10'],
            'rera_number' => ['nullable', 'string', 'max:80'],
            'start_date' => ['nullable', 'date'],
            'expected_completion' => ['nullable', 'date'],
            'total_units_planned' => ['nullable', 'integer', 'min:0'],
            'target_revenue' => ['nullable', 'numeric', 'min:0'],
            'image' => ['nullable', 'image', 'max:5120'],
        ]);
    }

    private function handleImage(Request $request): ?string
    {
        if (! $request->hasFile('image')) return null;
        return $request->file('image')->store('projects', 'public');
    }
}
