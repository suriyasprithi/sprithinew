<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddDriverShiftToUsers extends Migration
{
    public function up()
    {
        $this->forge->addColumn('users', [
            'shift' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'null'       => true,
                'after'      => 'hour_rate',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('users', 'shift');
    }
}
