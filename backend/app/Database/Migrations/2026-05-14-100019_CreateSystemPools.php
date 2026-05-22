<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateSystemPools extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'pool_key'   => ['type' => 'VARCHAR', 'constraint' => 50],
            'balance'    => ['type' => 'DECIMAL', 'constraint' => '14,2', 'default' => 0],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('pool_key');
        $this->forge->createTable('system_pools');

        $this->db->table('system_pools')->insert([
            'pool_key'   => 'admin_wallet',
            'balance'    => 0,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public function down()
    {
        $this->forge->dropTable('system_pools', true);
    }
}
