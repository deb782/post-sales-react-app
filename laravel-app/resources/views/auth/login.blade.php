<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-100">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign in — {{ config('app.name') }}</title>
    @vite(['resources/css/app.css', 'resources/js/app.js'])
</head>
<body class="h-full">
    <div class="min-h-full flex items-center justify-center px-4">
        <div class="w-full max-w-md">
            <div class="text-center mb-8">
                <div class="text-2xl font-semibold tracking-tight text-slate-900">{{ config('app.company_name') }}</div>
                <div class="text-sm text-slate-500 mt-1">Sign in to your dashboard</div>
            </div>

            <div class="card p-6">
                @if ($errors->any())
                    <div class="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                        {{ $errors->first() }}
                    </div>
                @endif

                <form method="POST" action="{{ route('login') }}" class="space-y-4">
                    @csrf
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Email</label>
                        <input type="email" name="email" value="{{ old('email') }}" required autofocus class="input">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Password</label>
                        <input type="password" name="password" required class="input">
                    </div>
                    <label class="flex items-center gap-2 text-sm text-slate-600">
                        <input type="checkbox" name="remember" class="rounded border-slate-300 text-brand-600">
                        Remember me
                    </label>
                    <button type="submit" class="btn-primary w-full justify-center">Sign in</button>
                </form>
            </div>

            <p class="text-center text-xs text-slate-500 mt-6">
                Trouble signing in? Ask your admin to reset your password.
            </p>
        </div>
    </div>
</body>
</html>
