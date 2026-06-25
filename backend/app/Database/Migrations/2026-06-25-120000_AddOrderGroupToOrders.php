<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * A single checkout can span multiple shops and becomes one `orders` row per
 * vendor. `order_group` is a ref stamped identically on every sub-order of the
 * same checkout so the customer app can show one order with per-shop sub-cards.
 * NULL for legacy single rows (grouped by their own id).
 */
class AddOrderGroupToOrders extends Migration
{
    public function up(): void
    {
        $fields = $this->db->getFieldNames('orders');
        if (! in_array('order_group', $fields, true)) {
            $this->forge->addColumn('orders', [
                'order_group' => ['type' => 'VARCHAR', 'constraint' => 40, 'null' => true, 'after' => 'id'],
            ]);
            $this->db->query('CREATE INDEX `idx_orders_order_group` ON `orders` (`order_group`)');
        }
    }

    public function down(): void
    {
        $this->forge->dropColumn('orders', 'order_group');
    }
}
