<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddUserIdToGeoTables extends Migration
{
    public function up()
    {
        $col = ['user_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true, 'after' => 'name']];
        $this->forge->addColumn('states', $col);
        $this->forge->addColumn('districts', $col);
        $this->forge->addColumn('taluks', $col);
    }

    public function down()
    {
        $this->forge->dropColumn('states', 'user_id');
        $this->forge->dropColumn('districts', 'user_id');
        $this->forge->dropColumn('taluks', 'user_id');
    }
}
