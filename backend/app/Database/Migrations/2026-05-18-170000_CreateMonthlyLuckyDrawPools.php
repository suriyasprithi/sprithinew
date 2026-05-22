<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateMonthlyLuckyDrawPools extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'              => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'period'          => ['type' => 'CHAR', 'constraint' => 7],         // 'YYYY-MM'
            'collected'       => ['type' => 'DECIMAL', 'constraint' => '14,2', 'default' => 0],
            'distributed'     => ['type' => 'DECIMAL', 'constraint' => '14,2', 'default' => 0],
            'winner_user_id'  => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'winner_amount'   => ['type' => 'DECIMAL', 'constraint' => '14,2', 'default' => 0],
            'distributed_at'  => ['type' => 'DATETIME', 'null' => true],
            'notes'           => ['type' => 'TEXT', 'null' => true],
            'created_at'      => ['type' => 'DATETIME', 'null' => true],
            'updated_at'      => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('period');
        $this->forge->addKey('winner_user_id');
        $this->forge->createTable('monthly_lucky_draw_pools');
    }

    public function down()
    {
        $this->forge->dropTable('monthly_lucky_draw_pools', true);
    }
}
