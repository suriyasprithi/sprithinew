<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateGeoTables extends Migration
{
    public function up()
    {
        // states
        $this->forge->addField([
            'id'         => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'name'       => ['type' => 'VARCHAR', 'constraint' => 100],
            'status'     => ['type' => "ENUM('active','inactive')", 'default' => 'active'],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->createTable('states');

        // districts
        $this->forge->addField([
            'id'         => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'state_id'   => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'name'       => ['type' => 'VARCHAR', 'constraint' => 100],
            'status'     => ['type' => "ENUM('active','inactive')", 'default' => 'active'],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('state_id');
        $this->forge->createTable('districts');

        // taluks
        $this->forge->addField([
            'id'          => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'district_id' => ['type' => 'INT', 'unsigned' => true],
            'name'        => ['type' => 'VARCHAR', 'constraint' => 100],
            'status'      => ['type' => "ENUM('active','inactive')", 'default' => 'active'],
            'created_at'  => ['type' => 'DATETIME', 'null' => true],
            'updated_at'  => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('district_id');
        $this->forge->createTable('taluks');

        // pincodes
        $this->forge->addField([
            'id'          => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'code'        => ['type' => 'VARCHAR', 'constraint' => 10],
            'district_id' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'taluk_id'    => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'created_at'  => ['type' => 'DATETIME', 'null' => true],
            'updated_at'  => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('code');
        $this->forge->addKey('district_id');
        $this->forge->addKey('taluk_id');
        $this->forge->createTable('pincodes');
    }

    public function down()
    {
        $this->forge->dropTable('pincodes', true);
        $this->forge->dropTable('taluks',   true);
        $this->forge->dropTable('districts',true);
        $this->forge->dropTable('states',   true);
    }
}
