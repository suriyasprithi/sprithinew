<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Prescription orders are billed by the vendor with free-form line items that
 * don't map to a catalog product, so order_items.product_id must allow NULL.
 * (Cart-placed orders still set it; the cancel() restock already guards on it.)
 */
class MakeOrderItemProductNullable extends Migration
{
    public function up(): void
    {
        $this->forge->modifyColumn('order_items', [
            'product_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
        ]);
    }

    public function down(): void
    {
        $this->forge->modifyColumn('order_items', [
            'product_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => false],
        ]);
    }
}
