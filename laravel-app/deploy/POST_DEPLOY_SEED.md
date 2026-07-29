# Post-deploy: seeding the admin against production DB

Both Hostinger and VPS deployments run `php artisan migrate --seed --force`
during setup, which creates the initial admin user with a randomly generated
14-character temporary password.

**Copy the temp password from the seeder output the moment it prints — it
is not saved anywhere and cannot be recovered.**

If you missed it, re-run just the seeder to generate a new one:

```bash
cd /path/to/laravel-app
php artisan db:seed --force
```

The seeder uses `updateOrCreate` on the email, so it re-hashes the
password and keeps the same user record — everyone else and their data
stays intact.

---

## Changing the seeded admin email

Edit `database/seeders/DatabaseSeeder.php`:

```php
$email = 'sales@agrocorp.co.in';   // ← change this
```

Then `php artisan db:seed --force`.

---

## Full production reset (wipe + seed fresh)

**⚠️ Deletes ALL data. Use only for UAT resets.**

```bash
php artisan migrate:fresh --seed --force
```

---

## Creating a second admin (without wiping)

```bash
php artisan tinker
>>> use App\Models\User;
>>> User::create([
...     'email' => 'newadmin@yourcompany.com',
...     'name' => 'New Admin',
...     'role' => 'admin',
...     'password' => 'TempPass123!',
...     'must_reset_password' => true,
... ]);
```
They'll be forced to set a new password on first login.
