<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateDistributeTokensTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'           => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'from_user_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'to_user_id'   => ['type' => 'BIGINT', 'unsigned' => true],
            'amount'       => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'tokens'       => ['type' => 'INT', 'unsigned' => true, 'default' => 0],
            'notes'        => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'created_at'   => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('from_user_id');
        $this->forge->addKey('to_user_id');
        $this->forge->createTable('distribute_tokens');
    }

    public function down()
    {
        $this->forge->dropTable('distribute_tokens', true);
    }
}
