<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateUsersTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'             => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'name'           => ['type' => 'VARCHAR', 'constraint' => 100],
            'email'          => ['type' => 'VARCHAR', 'constraint' => 150, 'null' => true],
            'mobile_number'  => ['type' => 'VARCHAR', 'constraint' => 15],
            'password_hash'  => ['type' => 'VARCHAR', 'constraint' => 255],
            'role'           => ['type' => "ENUM('customer','vendor','taluk','district','state','driver','admin')", 'default' => 'customer'],
            'status'         => ['type' => "ENUM('active','inactive','blocked')", 'default' => 'active'],
            'pincode'        => ['type' => 'VARCHAR', 'constraint' => 10, 'null' => true],
            'referrer_id'    => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'level_1_count'  => ['type' => 'INT', 'unsigned' => true, 'default' => 0],
            'level_2_count'  => ['type' => 'INT', 'unsigned' => true, 'default' => 0],
            'level_3_count'  => ['type' => 'INT', 'unsigned' => true, 'default' => 0],
            'wallet_balance' => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'level_wallet'   => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'level_1_wallet' => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'level_2_wallet' => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'level_3_wallet' => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'buyback_wallet' => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'global_wallet'  => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'token_balance'  => ['type' => 'INT', 'default' => 0],
            'created_at'     => ['type' => 'DATETIME', 'null' => true],
            'updated_at'     => ['type' => 'DATETIME', 'null' => true],
            'deleted_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey(['mobile_number', 'role']);
        $this->forge->addKey('email');
        $this->forge->addKey('role');
        $this->forge->addKey('status');
        $this->forge->addKey('referrer_id');
        $this->forge->createTable('users');
    }

    public function down()
    {
        $this->forge->dropTable('users');
    }
}
