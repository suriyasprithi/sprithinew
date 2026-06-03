<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Reusable admin "vendor templates" — a named preset of the setup fields the
 * New-vendor form configures (vendor category + commission %), so admins can
 * import one and pre-fill the form when onboarding similar vendors.
 */
class CreateVendorTemplatesTable extends Migration
{
    public function up()
    {
        if ($this->db->tableExists('vendor_templates')) return;

        $this->forge->addField([
            'id'                 => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'name'               => ['type' => 'VARCHAR', 'constraint' => 150],
            'vendor_category_id' => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'commission_pct'     => ['type' => 'DECIMAL', 'constraint' => '5,2', 'default' => 10.00],
            'created_by'         => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'created_at'         => ['type' => 'DATETIME', 'null' => true],
            'updated_at'         => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->createTable('vendor_templates');
    }

    public function down()
    {
        $this->forge->dropTable('vendor_templates', true);
    }
}
