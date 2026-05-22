<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateTokenRequestEventsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'         => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'request_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'actor_id'   => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'action'     => ['type' => 'VARCHAR', 'constraint' => 20],
            'from_level' => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'to_level'   => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'notes'      => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('request_id');
        $this->forge->addKey('actor_id');
        $this->forge->createTable('token_request_events');
    }

    public function down()
    {
        $this->forge->dropTable('token_request_events', true);
    }
}
