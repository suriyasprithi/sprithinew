<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateVendorCategoriesTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'               => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'name'             => ['type' => 'VARCHAR', 'constraint' => 100],
            'attribute_schema' => ['type' => 'JSON', 'null' => true],
            'status'           => ['type' => "ENUM('active','inactive')", 'default' => 'active'],
            'created_at'       => ['type' => 'DATETIME', 'null' => true],
            'updated_at'       => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('name');
        $this->forge->createTable('vendor_categories');
    }

    public function down()
    {
        $this->forge->dropTable('vendor_categories', true);
    }
}
