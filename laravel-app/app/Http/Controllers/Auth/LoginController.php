<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\View\View;

class LoginController extends Controller
{
    public function show(): View
    {
        return view('auth.login');
    }

    public function store(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        $email = strtolower($credentials['email']);
        $lock = DB::table('login_attempts')->where('email', $email)->first();

        if ($lock && $lock->locked_until && Carbon::parse($lock->locked_until)->isFuture()) {
            $mins = Carbon::parse($lock->locked_until)->diffInMinutes(now()) + 1;
            return back()->withErrors(['email' => "Too many attempts. Locked for {$mins} more minutes."])->onlyInput('email');
        }

        $user = User::where('email', $email)->first();

        if (! $user || ! $user->is_active || ! Hash::check($credentials['password'], $user->password)) {
            $count = ($lock?->count ?? 0) + 1;
            DB::table('login_attempts')->updateOrInsert(
                ['email' => $email],
                [
                    'count' => $count,
                    'locked_until' => $count >= 5 ? now()->addMinutes(15) : null,
                    'updated_at' => now(),
                    'created_at' => $lock->created_at ?? now(),
                ],
            );
            return back()->withErrors(['email' => 'Invalid credentials.'])->onlyInput('email');
        }

        DB::table('login_attempts')->where('email', $email)->delete();

        Auth::login($user, $request->boolean('remember'));
        $request->session()->regenerate();

        if ($user->must_reset_password) {
            return redirect()->route('password.reset');
        }

        return redirect()->intended(route('dashboard'));
    }

    public function destroy(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect()->route('login');
    }
}
