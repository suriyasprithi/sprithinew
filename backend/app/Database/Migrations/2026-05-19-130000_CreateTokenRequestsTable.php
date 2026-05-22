<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateTokenRequestsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'              => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'requester_id'    => ['type' => 'BIGINT', 'unsigned' => true],
            'target_user_id'  => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'amount'          => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'tokens'          => ['type' => 'INT', 'unsigned' => true, 'default' => 0],
            'status'          => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'pending'],
            'processed_by'    => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'notes'           => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'created_at'      => ['type' => 'DATETIME', 'null' => true],
            'updated_at'      => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('requester_id');
        $this->forge->addKey('target_user_id');
        $this->forge->addKey('status');
        $this->forge->createTable('token_requests');
    }

    public function down()
    {
        $this->forge->dropTable('token_requests', true);
    }
}
