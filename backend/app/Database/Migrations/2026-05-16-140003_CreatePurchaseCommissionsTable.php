<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreatePurchaseCommissionsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'             => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'order_id'       => ['type' => 'BIGINT', 'unsigned' => true],
            'beneficiary_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'source_user_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'level'          => ['type' => 'TINYINT', 'unsigned' => true],
            'percent'        => ['type' => 'DECIMAL', 'constraint' => '6,2', 'default' => 0],
            'amount'         => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'created_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('order_id');
        $this->forge->addKey('beneficiary_id');
        $this->forge->addKey('source_user_id');
        $this->forge->createTable('purchase_commissions');
    }

    public function down()
    {
        $this->forge->dropTable('purchase_commissions', true);
    }
}
