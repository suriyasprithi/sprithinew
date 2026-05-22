<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateMonthlyGlobalPoolsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'              => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'period'          => ['type' => 'CHAR', 'constraint' => 7],         // 'YYYY-MM'
            'collected'       => ['type' => 'DECIMAL', 'constraint' => '14,2', 'default' => 0],
            'distributed'     => ['type' => 'DECIMAL', 'constraint' => '14,2', 'default' => 0],
            'eligible_count'  => ['type' => 'INT', 'unsigned' => true, 'default' => 0],
            'per_user_amount' => ['type' => 'DECIMAL', 'constraint' => '14,2', 'default' => 0],
            'distributed_at'  => ['type' => 'DATETIME', 'null' => true],
            'notes'           => ['type' => 'TEXT', 'null' => true],
            'created_at'      => ['type' => 'DATETIME', 'null' => true],
            'updated_at'      => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('period');
        $this->forge->createTable('monthly_global_pools');
    }

    public function down()
    {
        $this->forge->dropTable('monthly_global_pools', true);
    }
}
