<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateReferralsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'           => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'referrer_id'  => ['type' => 'BIGINT', 'unsigned' => true],
            'referred_id'  => ['type' => 'BIGINT', 'unsigned' => true],
            'level'        => ['type' => 'TINYINT', 'unsigned' => true, 'default' => 1],
            'bonus_amount' => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'created_at'   => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['referrer_id', 'referred_id']);
        $this->forge->addKey('referrer_id');
        $this->forge->addKey('referred_id');
        $this->forge->createTable('referrals');
    }

    public function down()
    {
        $this->forge->dropTable('referrals', true);
    }
}
