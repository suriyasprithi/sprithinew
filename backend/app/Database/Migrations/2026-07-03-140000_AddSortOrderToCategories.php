<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Manual display order for product categories, scoped per vendor category. The
 * admin Product Categories page lets you drag to reorder the product categories
 * within one vendor category (e.g. arrange Supermarket's categories), and the
 * customer browse / product rails read them in this order.
 *
 * Existing rows are seeded 1..N within each vendor_category (by id) so the
 * current order is preserved until an admin changes it. Mirrors the
 * vendor_categories.display_order pattern.
 */
class AddSortOrderToCategories extends Migration
{
    public function up(): void
    {
        $fields = $this->db->getFieldNames('categories');
        if (! in_array('sort_order', $fields, true)) {
            $this->forge->addColumn('categories', [
                'sort_order' => ['type' => 'INT', 'unsigned' => true, 'null' => false, 'default' => 0, 'after' => 'status'],
            ]);
        }

        // Seed 1..N within each vendor_category group (NULL grouped as 0).
        $rows = $this->db->table('categories')
            ->select('id, vendor_category_id')
            ->orderBy('vendor_category_id', 'ASC')
            ->orderBy('id', 'ASC')
            ->get()->getResultArray();
        $pos = [];
        foreach ($rows as $r) {
            $g = (int) ($r['vendor_category_id'] ?? 0);
            $pos[$g] = ($pos[$g] ?? 0) + 1;
            $this->db->table('categories')->where('id', (int) $r['id'])->update(['sort_order' => $pos[$g]]);
        }
    }

    public function down(): void
    {
        $this->forge->dropColumn('categories', 'sort_order');
    }
}
