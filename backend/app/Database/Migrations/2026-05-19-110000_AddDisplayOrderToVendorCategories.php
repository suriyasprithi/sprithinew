<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Vendor categories drag-and-reorder support. Admins can rearrange the
 * Vendor Categories list and the order persists. Lower number = higher
 * position. Defaults to 0 so freshly inserted rows land at the top until
 * the admin moves them.
 */
class AddDisplayOrderToVendorCategories extends Migration
{
    public function up(): void
    {
        $fields = $this->db->getFieldNames('vendor_categories');
        if (in_array('display_order', $fields, true)) return;

        $this->forge->addColumn('vendor_categories', [
            'display_order' => [
                'type'       => 'INT',
                'unsigned'   => true,
                'null'       => false,
                'default'    => 0,
                'after'      => 'status',
            ],
        ]);

        // Seed positions from current id order so existing rows have stable order.
        $rows = $this->db->table('vendor_categories')->select('id')->orderBy('id', 'ASC')->get()->getResultArray();
        $i = 1;
        foreach ($rows as $r) {
            $this->db->table('vendor_categories')->where('id', (int) $r['id'])->update(['display_order' => $i++]);
        }
    }

    public function down(): void
    {
        $fields = $this->db->getFieldNames('vendor_categories');
        if (in_array('display_order', $fields, true)) {
            $this->forge->dropColumn('vendor_categories', 'display_order');
        }
    }
}
