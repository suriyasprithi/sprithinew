<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateDeviceTokensTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'         => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'    => ['type' => 'BIGINT', 'unsigned' => true],
            'token'      => ['type' => 'VARCHAR', 'constraint' => 255],
            'platform'   => ['type' => "ENUM('android','ios','web')", 'default' => 'android'],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('token');
        $this->forge->addKey('user_id');
        $this->forge->createTable('device_tokens');
    }

    public function down()
    {
        $this->forge->dropTable('device_tokens', true);
    }
}
