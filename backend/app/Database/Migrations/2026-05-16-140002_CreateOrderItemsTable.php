<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateOrderItemsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'              => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'order_id'        => ['type' => 'BIGINT', 'unsigned' => true],
            'product_id'      => ['type' => 'BIGINT', 'unsigned' => true],
            'variation_id'    => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'variation_label' => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'name'            => ['type' => 'VARCHAR', 'constraint' => 200],
            'qty'             => ['type' => 'INT', 'unsigned' => true, 'default' => 1],
            'price'           => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'subtotal'        => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('order_id');
        $this->forge->addKey('product_id');
        $this->forge->createTable('order_items');
    }

    public function down()
    {
        $this->forge->dropTable('order_items', true);
    }
}
