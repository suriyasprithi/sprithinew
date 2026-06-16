<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Return-window support:
 *   - orders.delivered_at — when the order was delivered; the return window is
 *     measured from this (the admin setting `returns.window_days`, 0 = disabled).
 *   - order_returns — one row per customer return request (pending for now).
 */
class AddReturnsSupport extends Migration
{
    public function up()
    {
        // 1) delivered_at on orders. Backfill already-delivered orders from
        //    updated_at (best-effort — those orders' window has usually passed).
        if (! $this->db->fieldExists('delivered_at', 'orders')) {
            $this->forge->addColumn('orders', [
                'delivered_at' => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->db->query("UPDATE orders SET delivered_at = updated_at WHERE status = 'delivered' AND delivered_at IS NULL");
        }

        // 2) order_returns — customer return requests.
        if (! $this->db->tableExists('order_returns')) {
            $this->forge->addField([
                'id'          => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
                'order_id'    => ['type' => 'BIGINT', 'unsigned' => true],
                'customer_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'reason'      => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
                'status'      => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'pending'], // pending (future: approved/rejected/returned)
                'created_at'  => ['type' => 'DATETIME', 'null' => true],
                'updated_at'  => ['type' => 'DATETIME', 'null' => true],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addKey('order_id');
            $this->forge->addKey('customer_id');
            $this->forge->addKey('status');
            $this->forge->createTable('order_returns', true);
        }
    }

    public function down()
    {
        $this->forge->dropTable('order_returns', true);
        if ($this->db->fieldExists('delivered_at', 'orders')) {
            $this->forge->dropColumn('orders', 'delivered_at');
        }
    }
}
