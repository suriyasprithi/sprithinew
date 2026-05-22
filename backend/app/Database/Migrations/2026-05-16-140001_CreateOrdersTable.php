<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateOrdersTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'          => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'customer_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'vendor_id'   => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'total'       => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'status'      => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'pending'],
            'notes'       => ['type' => 'TEXT', 'null' => true],
            'created_at'  => ['type' => 'DATETIME', 'null' => true],
            'updated_at'  => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('customer_id');
        $this->forge->addKey('vendor_id');
        $this->forge->addKey('status');
        $this->forge->createTable('orders');
    }

    public function down()
    {
        $this->forge->dropTable('orders', true);
    }
}
