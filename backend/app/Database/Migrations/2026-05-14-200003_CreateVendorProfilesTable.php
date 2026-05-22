<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateVendorProfilesTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'user_id'            => ['type' => 'BIGINT', 'unsigned' => true],
            'vendor_category_id' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'shop_name'          => ['type' => 'VARCHAR', 'constraint' => 150],
            'address'            => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'area'               => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'state_id'           => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'district_id'        => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'taluk_id'           => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'pincode'            => ['type' => 'VARCHAR', 'constraint' => 10, 'null' => true],
            'gst'                => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'image'              => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'created_at'         => ['type' => 'DATETIME', 'null' => true],
            'updated_at'         => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('user_id');
        $this->forge->addKey('vendor_category_id');
        $this->forge->addKey('state_id');
        $this->forge->addKey('district_id');
        $this->forge->addKey('taluk_id');
        $this->forge->addKey('pincode');
        $this->forge->createTable('vendor_profiles');
    }

    public function down()
    {
        $this->forge->dropTable('vendor_profiles', true);
    }
}
