<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-100">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Set a new password — {{ config('app.name') }}</title>

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
            <div class="text-center mb-6">
                <div class="text-2xl font-semibold tracking-tight text-slate-900">Set a new password</div>
                <div class="text-sm text-slate-500 mt-1">Required before you can use the dashboard.</div>
            </div>

            <div class="card p-6">
                @if ($errors->any())
                    <div class="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                        {{ $errors->first() }}
                    </div>
                @endif

                <form method="POST" action="{{ route('password.update') }}" class="space-y-4">
                    @csrf
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Current (temp) password</label>
                        <input type="password" name="current_password" required autofocus class="input">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">New password</label>
                        <input type="password" name="password" required class="input">
                        <p class="mt-1 text-xs text-slate-500">Min 8 characters, must include letters and numbers.</p>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-slate-700 mb-1">Confirm new password</label>
                        <input type="password" name="password_confirmation" required class="input">
                    </div>
                    <button type="submit" class="btn-primary w-full">Update password</button>
                </form>
            </div>
        </div>
    </div>
</body>
</html>
