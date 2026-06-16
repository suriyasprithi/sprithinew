<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Order cancellation (Phase 1) support on the orders table:
 *   - cancel_reason — the customer's free-text reason
 *   - cancelled_at  — when it was cancelled
 *   - penalty       — amount actually charged from the wallet (0 = none)
 * Eligibility/penalty rules live in admin settings (cancel.window_hours,
 * cancel.penalty, cancel.valid_reasons). Only un-settled COD orders (status
 * 'pending') can be cancelled; wallet orders settle at placement → Return.
 */
class AddCancellationSupport extends Migration
{
    public function up()
    {
        $cols = [];
        if (! $this->db->fieldExists('cancel_reason', 'orders')) {
            $cols['cancel_reason'] = ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true];
        }
        if (! $this->db->fieldExists('cancelled_at', 'orders')) {
            $cols['cancelled_at'] = ['type' => 'DATETIME', 'null' => true];
        }
        if (! $this->db->fieldExists('penalty', 'orders')) {
            $cols['penalty'] = ['type' => 'DECIMAL', 'constraint' => '12,2', 'null' => true];
        }
        if ($cols) $this->forge->addColumn('orders', $cols);
    }

    public function down()
    {
        foreach (['cancel_reason', 'cancelled_at', 'penalty'] as $c) {
            if ($this->db->fieldExists($c, 'orders')) $this->forge->dropColumn('orders', $c);
        }
    }
}
