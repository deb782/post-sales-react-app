<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-100">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Sign in — {{ config('app.name') }}</title>

    <script src="https://cdn.tailwindcss.com?plugins=forms"></script>
    <script>
        tailwind.config = { theme: { extend: { colors: { brand: {
            500: '#3d5afe', 600: '#2f47d1', 700: '#2337a3'
        } } } } }
    </script>
    <style type="text/tailwindcss">
        @layer components {
            .btn-primary { @apply inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm bg-brand-600 text-white hover:bg-brand-700 transition; }
            .input { @apply w-full rounded-lg border-slate-300 focus:border-brand-500 focus:ring-brand-500 text-sm; }
            .card { @apply bg-white rounded-xl border border-slate-200 shadow-sm; }
        }
    </style>
</head>
<body class="h-full">
    <div class="min-h-full flex items-center justify-center px-4">
        <div class="w-full max-w-md">
            <div class="text-center mb-8">
                <div class="text-2xl font-semibold tracking-tight text-slate-900">{{ config('app.company_name', config('app.name')) }}</div>
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
                    <button type="submit" class="btn-primary w-full">Sign in</button>
                </form>
            </div>

            <p class="text-center text-xs text-slate-500 mt-6">
                Trouble signing in? Ask your admin to reset your password.
            </p>
        </div>
    </div>
</body>
</html>
