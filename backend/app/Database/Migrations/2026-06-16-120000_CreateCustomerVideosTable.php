<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateCustomerVideosTable extends Migration
{
    // Admin-managed promo videos shown in the customer home "Customer videos"
    // carousel. Uploaded directly by admin (no vendor request involved).
    public function up()
    {
        $this->forge->addField([
            'id'         => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'title'      => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true],
            'video_path' => ['type' => 'VARCHAR', 'constraint' => 255],
            'sort_order' => ['type' => 'INT', 'default' => 0],
            'status'     => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'active'], // active | inactive
            'created_at' => ['type' => 'DATETIME', 'null' => true],
            'updated_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('status');
        $this->forge->createTable('customer_videos', true);
    }

    public function down()
    {
        $this->forge->dropTable('customer_videos', true);
    }
}
