<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateMonthlyGlobalDistributionsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'         => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'pool_id'    => ['type' => 'BIGINT', 'unsigned' => true],
            'user_id'    => ['type' => 'BIGINT', 'unsigned' => true],
            'amount'     => ['type' => 'DECIMAL', 'constraint' => '14,2', 'default' => 0],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('pool_id');
        $this->forge->addKey('user_id');
        $this->forge->addUniqueKey(['pool_id', 'user_id']);
        $this->forge->createTable('monthly_global_distributions');
    }

    public function down()
    {
        $this->forge->dropTable('monthly_global_distributions', true);
    }
}
