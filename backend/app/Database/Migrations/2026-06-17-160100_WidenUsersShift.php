<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class WidenUsersShift extends Migration
{
    public function up()
    {
        // Shifts are now admin-defined by name (was a fixed morning/evening/night
        // enum-like string). Widen to hold the chosen shift name.
        $this->forge->modifyColumn('users', [
            'shift' => [
                'name'       => 'shift',
                'type'       => 'VARCHAR',
                'constraint' => 50,
                'null'       => true,
            ],
        ]);
    }

    public function down()
    {
        $this->forge->modifyColumn('users', [
            'shift' => [
                'name'       => 'shift',
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
            ],
        ]);
    }
}
