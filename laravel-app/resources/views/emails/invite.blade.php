<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Welcome to {{ config('app.name') }}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f7fb; margin: 0; padding: 24px;">
    <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 8px; padding: 32px; border: 1px solid #e2e8f0;">
        <h1 style="font-size: 20px; color: #0f172a; margin: 0 0 16px;">Welcome, {{ $name }}</h1>

        <p style="color: #334155; line-height: 1.55;">
            You've been invited to <strong>{{ config('app.name') }}</strong> as
            <strong>{{ str_replace('_', ' ', ucwords($role, '_')) }}</strong>.
        </p>

        <p style="color: #334155; line-height: 1.55;">
            Use the credentials below to log in. You'll be asked to set a new password immediately.
        </p>

        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
            <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Email</td>
                <td style="padding: 8px 0; color: #0f172a;">{{ $email }}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 12px; text-transform: uppercase;">Temporary password</td>
                <td style="padding: 8px 0; color: #0f172a;"><code style="background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">{{ $tempPassword }}</code></td>
            </tr>
        </table>

        <p style="margin: 24px 0;">
            <a href="{{ $loginUrl }}"
               style="display: inline-block; background: #2f47d1; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
                Log in now
            </a>
        </p>

        <p style="color: #64748b; font-size: 12px; margin-top: 32px;">
            If you weren't expecting this invite, please ignore this email.
        </p>
    </div>
</body>
</html>
