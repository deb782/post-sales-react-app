<?php

namespace App\Http\Controllers;

use App\Mail\InviteMail;
use App\Models\AuditLog;
use App\Models\Project;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\View\View;

class UserController extends Controller
{
    public function index(): View
    {
        $users = User::orderBy('created_at', 'desc')->get();
        $projects = Project::orderBy('name')->get();
        return view('users.index', compact('users', 'projects'));
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'unique:users,email'],
            'name' => ['required', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'role' => ['required', 'in:admin,accounts,management,site_manager'],
            'project_ids' => ['array'],
            'project_ids.*' => ['exists:projects,id'],
        ]);

        $temp = Str::password(12, letters: true, numbers: true, symbols: false, spaces: false);

        $user = DB::transaction(function () use ($data, $temp) {
            $user = User::create([
                'email' => strtolower($data['email']),
                'name' => $data['name'],
                'phone' => $data['phone'] ?? null,
                'role' => $data['role'],
                'password' => $temp,
                'must_reset_password' => true,
                'is_active' => true,
            ]);
            if (! empty($data['project_ids'])) {
                $user->projects()->sync($data['project_ids']);
            }
            return $user;
        });

        $emailStatus = 'not_sent';
        try {
            Mail::to($user->email)->send(new InviteMail($user, $temp));
            $emailStatus = 'sent';
        } catch (\Throwable $e) {
            Log::warning('Invite email failed: '.$e->getMessage());
        }

        AuditLog::create([
            'actor_id' => auth()->id(),
            'actor_role' => auth()->user()->role,
            'action' => 'user.invite',
            'entity_type' => 'user',
            'entity_id' => $user->id,
            'meta' => ['email_status' => $emailStatus],
            'created_at' => now(),
        ]);

        return back()->with('status', $emailStatus === 'sent'
            ? "Invite sent to {$user->email}."
            : "User created. SMTP send failed — share this temp password manually: {$temp}");
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:30'],
            'role' => ['sometimes', 'in:admin,accounts,management,site_manager'],
            'is_active' => ['sometimes', 'boolean'],
            'project_ids' => ['array'],
            'project_ids.*' => ['exists:projects,id'],
        ]);

        $user->update(collect($data)->except('project_ids')->all());
        if (isset($data['project_ids'])) {
            $user->projects()->sync($data['project_ids']);
        }

        return back()->with('status', 'User updated.');
    }

    public function resetPassword(User $user): RedirectResponse
    {
        $temp = Str::password(12, letters: true, numbers: true, symbols: false, spaces: false);
        $user->update(['password' => $temp, 'must_reset_password' => true]);
        DB::table('login_attempts')->where('email', $user->email)->delete();

        $status = 'not_sent';
        try {
            Mail::to($user->email)->send(new InviteMail($user, $temp));
            $status = 'sent';
        } catch (\Throwable $e) {}

        return back()->with('status', $status === 'sent'
            ? "New temp password emailed to {$user->email}."
            : "Temp password (email failed): {$temp}");
    }

    public function destroy(User $user): RedirectResponse
    {
        $user->update(['is_active' => false]);
        return back()->with('status', "{$user->name} deactivated.");
    }
}
