<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateProductsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'           => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'vendor_id'    => ['type' => 'BIGINT', 'unsigned' => true],
            'category_id'  => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'name'         => ['type' => 'VARCHAR', 'constraint' => 200],
            'description'  => ['type' => 'TEXT', 'null' => true],
            'price'        => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'stock'        => ['type' => 'INT', 'default' => 0],
            'image'        => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'attributes'   => ['type' => 'JSON', 'null' => true],
            'has_variants' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'status'       => ['type' => "ENUM('active','inactive')", 'default' => 'active'],
            'created_at'   => ['type' => 'DATETIME', 'null' => true],
            'updated_at'   => ['type' => 'DATETIME', 'null' => true],
            'deleted_at'   => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('vendor_id');
        $this->forge->addKey('category_id');
        $this->forge->addKey('status');
        $this->forge->createTable('products');
    }

    public function down()
    {
        $this->forge->dropTable('products', true);
    }
}
