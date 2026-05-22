<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateProductVariantsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'         => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'product_id' => ['type' => 'BIGINT', 'unsigned' => true],
            'name'       => ['type' => 'VARCHAR', 'constraint' => 100],
            'price'      => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'stock'      => ['type' => 'INT', 'default' => 0],
            'image'      => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'status'     => ['type' => "ENUM('active','inactive')", 'default' => 'active'],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('product_id');
        $this->forge->createTable('product_variants');
    }

    public function down()
    {
        $this->forge->dropTable('product_variants', true);
    }
}
