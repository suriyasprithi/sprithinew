<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Per-row QR-purchase transfer support.
 * A customer-scanned QR purchase credits the vendor's QR wallet (not the main
 * wallet). The vendor moves each purchase to their main wallet individually;
 * qr_transferred_at stamps when that happened (null = still in the QR wallet).
 */
class AddQrTransferredAtToOrders extends Migration
{
    public function up()
    {
        if (! $this->db->fieldExists('qr_transferred_at', 'orders')) {
            $this->forge->addColumn('orders', [
                'qr_transferred_at' => ['type' => 'DATETIME', 'null' => true],
            ]);
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('qr_transferred_at', 'orders')) {
            $this->forge->dropColumn('orders', 'qr_transferred_at');
        }
    }
}
