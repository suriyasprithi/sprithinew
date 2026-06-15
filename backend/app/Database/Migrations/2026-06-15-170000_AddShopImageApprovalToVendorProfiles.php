<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Shop-image approval workflow. The live `image` column keeps showing the
 * approved image to customers; a newly uploaded image lands in `image_pending`
 * with `image_status = 'pending'` until an admin approves (moved to `image`) or
 * rejects (with `image_reject_reason`). Existing images are grandfathered as
 * approved (status stays NULL) so they keep showing.
 */
class AddShopImageApprovalToVendorProfiles extends Migration
{
    public function up()
    {
        $cols = [];
        if (! $this->db->fieldExists('image_pending', 'vendor_profiles')) {
            $cols['image_pending'] = ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true];
        }
        if (! $this->db->fieldExists('image_status', 'vendor_profiles')) {
            $cols['image_status'] = ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true];
        }
        if (! $this->db->fieldExists('image_reject_reason', 'vendor_profiles')) {
            $cols['image_reject_reason'] = ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true];
        }
        if (! $this->db->fieldExists('image_reviewed_by', 'vendor_profiles')) {
            $cols['image_reviewed_by'] = ['type' => 'BIGINT', 'unsigned' => true, 'null' => true];
        }
        if ($cols) {
            $this->forge->addColumn('vendor_profiles', $cols);
        }
    }

    public function down()
    {
        foreach (['image_pending', 'image_status', 'image_reject_reason', 'image_reviewed_by'] as $c) {
            if ($this->db->fieldExists($c, 'vendor_profiles')) {
                $this->forge->dropColumn('vendor_profiles', $c);
            }
        }
    }
}
