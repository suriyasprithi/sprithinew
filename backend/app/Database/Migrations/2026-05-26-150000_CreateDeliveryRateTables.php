<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateDeliveryRateTables extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'           => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'taluk_id'     => ['type' => 'INT', 'unsigned' => true],
            'from_km'      => ['type' => 'DECIMAL', 'constraint' => '8,2'],
            'to_km'        => ['type' => 'DECIMAL', 'constraint' => '8,2'],
            'price_per_km' => ['type' => 'DECIMAL', 'constraint' => '10,2'],
            'created_at'   => ['type' => 'DATETIME', 'null' => true],
            'updated_at'   => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('taluk_id');
        $this->forge->createTable('delivery_km_slabs');

        $this->forge->addField([
            'id'         => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'taluk_id'   => ['type' => 'INT', 'unsigned' => true],
            'time_min'   => ['type' => 'INT', 'unsigned' => true],
            'price'      => ['type' => 'DECIMAL', 'constraint' => '10,2'],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('taluk_id');
        $this->forge->createTable('delivery_time_rates');
    }

    public function down()
    {
        $this->forge->dropTable('delivery_time_rates', true);
        $this->forge->dropTable('delivery_km_slabs', true);
    }
}
