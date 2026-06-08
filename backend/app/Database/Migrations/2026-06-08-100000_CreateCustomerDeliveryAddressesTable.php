<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateCustomerDeliveryAddressesTable extends Migration
{
    // Named *_delivery_addresses to avoid colliding with the legacy
    // `customer_addresses` table from the V2 import dump (different schema).
    public function up()
    {
        $this->forge->addField([
            'id'           => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'customer_id'  => ['type' => 'BIGINT', 'unsigned' => true],
            'address_line' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'landmark'     => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'city'         => ['type' => 'VARCHAR', 'constraint' => 80,  'null' => true],
            'pincode'      => ['type' => 'VARCHAR', 'constraint' => 10,  'null' => true],
            'is_default'   => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'created_at'   => ['type' => 'DATETIME', 'null' => true],
            'updated_at'   => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('customer_id');
        $this->forge->addKey(['customer_id', 'is_default']);
        $this->forge->createTable('customer_delivery_addresses');

        // Backfill: copy each customer's existing single address (any non-empty
        // field) into one row, marked default.
        $db  = \Config\Database::connect();
        $now = date('Y-m-d H:i:s');
        $rows = $db->query(
            "SELECT id, address_line, landmark, city, pincode
             FROM users
             WHERE role = 'customer'
               AND deleted_at IS NULL
               AND ( COALESCE(NULLIF(TRIM(address_line), ''), '') <> ''
                  OR COALESCE(NULLIF(TRIM(landmark), ''), '')     <> ''
                  OR COALESCE(NULLIF(TRIM(city), ''), '')         <> '' )"
        )->getResultArray();

        $insert = [];
        foreach ($rows as $r) {
            $insert[] = [
                'customer_id'  => (int) $r['id'],
                'address_line' => $r['address_line'] ?: null,
                'landmark'     => $r['landmark'] ?: null,
                'city'         => $r['city'] ?: null,
                'pincode'      => $r['pincode'] ?: null,
                'is_default'   => 1,
                'created_at'   => $now,
                'updated_at'   => $now,
            ];
        }
        if ($insert) {
            $db->table('customer_delivery_addresses')->insertBatch($insert);
        }
    }

    public function down()
    {
        $this->forge->dropTable('customer_delivery_addresses', true);
    }
}
