<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateDriverShifts extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'         => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'name'       => ['type' => 'VARCHAR', 'constraint' => 50],
            'start_time' => ['type' => 'TIME', 'null' => true],
            'end_time'   => ['type' => 'TIME', 'null' => true],
            'is_active'  => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->createTable('driver_shifts', true);
    }

    public function down()
    {
        $this->forge->dropTable('driver_shifts', true);
    }
}
