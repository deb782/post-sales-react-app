<x-mail::message>
# Welcome, {{ $name }}

You've been invited to **{{ config('app.name') }}** as **{{ str_replace('_', ' ', ucwords($role, '_')) }}**.

Use the credentials below to log in. You'll be asked to set a new password immediately.

**Login URL:** [{{ $loginUrl }}]({{ $loginUrl }})
**Email:** {{ $email }}
**Temporary password:** `{{ $tempPassword }}`

<x-mail::button :url="$loginUrl">Log in now</x-mail::button>

If you weren't expecting this invite, please ignore this email.

Thanks,
{{ config('app.name') }}
</x-mail::message>
