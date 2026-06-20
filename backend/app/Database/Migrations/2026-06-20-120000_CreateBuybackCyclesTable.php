<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Overlapping buyback cycles. Every purchase opens a cycle for the buyer
 * (unless they already have one open), and each open cycle collects from the
 * next 4 DISTINCT buyers at slot rates 15/10/5/2.5% of each buyer's pool.
 * Replaces the old single-eligible-user model (one global buyback.eligible_user_id).
 *
 *   next_slot 1..4 = which slot the next distinct buyer fills.
 *   status open    = still collecting; completed = all 4 slots filled.
 */
class CreateBuybackCyclesTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'           => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'      => ['type' => 'BIGINT', 'unsigned' => true],          // the collector
            'next_slot'    => ['type' => 'TINYINT', 'unsigned' => true, 'default' => 1],
            'status'       => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'open'], // open | completed
            'opened_at'    => ['type' => 'DATETIME', 'null' => true],
            'completed_at' => ['type' => 'DATETIME', 'null' => true],
            'created_at'   => ['type' => 'DATETIME', 'null' => true],
            'updated_at'   => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['status', 'opened_at']);  // load open cycles oldest-first
        $this->forge->addKey(['user_id', 'status']);    // find a user's open cycle
        $this->forge->createTable('buyback_cycles', true);
    }

    public function down()
    {
        $this->forge->dropTable('buyback_cycles', true);
    }
}
