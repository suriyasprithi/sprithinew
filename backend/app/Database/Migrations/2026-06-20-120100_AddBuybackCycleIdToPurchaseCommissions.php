<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Tag each buyback payout (level -1..-4) with the cycle it filled. Lets the
 * distinct-buyer check scope to the collector's CURRENT cycle, so a buyer who
 * paid an earlier (closed) cycle can pay the collector's new cycle.
 */
class AddBuybackCycleIdToPurchaseCommissions extends Migration
{
    public function up()
    {
        $this->forge->addColumn('purchase_commissions', [
            'buyback_cycle_id' => [
                'type'     => 'BIGINT',
                'unsigned' => true,
                'null'     => true,
                'after'    => 'level',
            ],
        ]);
        $this->db->query('CREATE INDEX pc_buyback_cycle ON purchase_commissions (buyback_cycle_id)');
    }

    public function down()
    {
        $this->db->query('DROP INDEX pc_buyback_cycle ON purchase_commissions');
        $this->forge->dropColumn('purchase_commissions', 'buyback_cycle_id');
    }
}
