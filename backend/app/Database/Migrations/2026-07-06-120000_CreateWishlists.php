<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateWishlists extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'         => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true, 'auto_increment' => true],
            'user_id'    => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true],
            'product_id' => ['type' => 'INT', 'constraint' => 11, 'unsigned' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        // A product can be wishlisted once per user; the lookup is always by user.
        $this->forge->addUniqueKey(['user_id', 'product_id']);
        $this->forge->addKey('user_id');
        $this->forge->createTable('wishlists', true);
    }

    public function down()
    {
        $this->forge->dropTable('wishlists', true);
    }
}
