<?php

namespace Database\Seeders;

use App\Models\Setting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        Setting::current();

        $email = 'sales@agrocorp.co.in';
        $tempPassword = Str::password(14, letters: true, numbers: true, symbols: false, spaces: false);

        User::updateOrCreate(
            ['email' => $email],
            [
                'name' => 'Agrocorp Admin',
                'role' => 'admin',
                'password' => $tempPassword,
                'must_reset_password' => true,
                'is_active' => true,
                'onboarding_completed' => false,
            ],
        );

        $this->command->newLine();
        $this->command->line('===================================');
        $this->command->info(' Admin seeded');
        $this->command->line('===================================');
        $this->command->line(" Email    : {$email}");
        $this->command->line(" Password : {$tempPassword}");
        $this->command->line('===================================');
        $this->command->newLine();
    }
}
