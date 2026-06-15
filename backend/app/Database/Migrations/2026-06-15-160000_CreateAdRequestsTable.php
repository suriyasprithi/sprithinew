<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateAdRequestsTable extends Migration
{
    // Vendor-submitted ad requests (banner image / promo video) reviewed by admin.
    public function up()
    {
        $this->forge->addField([
            'id'           => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'vendor_id'    => ['type' => 'BIGINT', 'unsigned' => true],
            'type'         => ['type' => 'VARCHAR', 'constraint' => 10],              // banner | video
            'attachment'   => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'notes'        => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'status'       => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'pending'],
            'processed_by' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'created_at'   => ['type' => 'DATETIME', 'null' => true],
            'updated_at'   => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('vendor_id');
        $this->forge->addKey('status');
        $this->forge->addKey('type');
        $this->forge->createTable('ad_requests', true);
    }

    public function down()
    {
        $this->forge->dropTable('ad_requests', true);
    }
}
