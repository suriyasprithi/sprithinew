<?php

namespace App\Database\Seeds;

use App\Models\UserModel;
use CodeIgniter\Database\Seeder;

/**
 * V2 bootstrap seeder. Creates the first admin so the app has someone
 * who can create states/districts/drivers via the API.
 *
 * Usage: php spark db:seed DatabaseSeeder
 * Idempotent — re-running skips existing rows.
 */
class DatabaseSeeder extends Seeder
{
    public function run()
    {
        $users = new UserModel();

        $mobile = '9999000001';
        $role   = 'admin';
        if ($users->mobileExistsForRole($mobile, $role)) {
            echo "Skip (exists): {$mobile} / {$role}\n";
            return;
        }
        $users->insert([
            'name'          => 'Bootstrap Admin',
            'mobile_number' => $mobile,
            'password_hash' => password_hash('change-me', PASSWORD_BCRYPT),
            'role'          => $role,
            'status'        => 'active',
        ]);
        echo "Created admin: {$mobile} / change-me  (please change after first login)\n";
    }
}
