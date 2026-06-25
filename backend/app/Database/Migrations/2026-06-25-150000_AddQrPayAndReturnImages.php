<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Three small additions:
 *  - orders.qr_visible_to_driver — vendor per-order toggle; hides the pickup QR
 *    from the driver when off (default on).
 *  - orders.paid_via — records 'qr' when a COD order is paid by the customer
 *    scanning the vendor QR at delivery (wallet flow), for the Paid(QR) badge
 *    + the QR Payments table.
 *  - order_returns.images — JSON array of photo paths the customer attaches to a
 *    return, shown to the vendor as thumbnails.
 */
class AddQrPayAndReturnImages extends Migration
{
    public function up(): void
    {
        $oFields = $this->db->getFieldNames('orders');
        $add = [];
        if (! in_array('qr_visible_to_driver', $oFields, true)) {
            $add['qr_visible_to_driver'] = ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1, 'after' => 'driver_id'];
        }
        if (! in_array('paid_via', $oFields, true)) {
            $add['paid_via'] = ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true, 'after' => 'payment_method'];
        }
        if ($add) $this->forge->addColumn('orders', $add);

        if (! in_array('images', $this->db->getFieldNames('order_returns'), true)) {
            $this->forge->addColumn('order_returns', [
                'images' => ['type' => 'TEXT', 'null' => true, 'after' => 'reason'],
            ]);
        }
    }

    public function down(): void
    {
        $this->forge->dropColumn('orders', 'qr_visible_to_driver');
        $this->forge->dropColumn('orders', 'paid_via');
        $this->forge->dropColumn('order_returns', 'images');
    }
}
