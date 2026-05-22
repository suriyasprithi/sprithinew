<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateVariantTypeGroupsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'         => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'name'       => ['type' => 'VARCHAR', 'constraint' => 100],
            'fields'     => ['type' => 'TEXT', 'null' => true],
            'status'     => ['type' => "ENUM('active','inactive')", 'default' => 'active'],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('name');
        $this->forge->createTable('variant_type_groups');
    }

    public function down()
    {
        $this->forge->dropTable('variant_type_groups', true);
    }
}
