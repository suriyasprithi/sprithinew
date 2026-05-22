<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Per-customer buyback cycle state.
 * 0 = no active cycle (not eligible).
 * 1..4 = which slot fires next when someone else purchases.
 */
class AddBuybackCycleSlotToUsers extends Migration
{
    public function up()
    {
        $this->forge->addColumn('users', [
            'buyback_next_slot' => [
                'type'     => 'TINYINT',
                'unsigned' => true,
                'default'  => 0,
                'after'    => 'buyback_wallet',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('users', 'buyback_next_slot');
    }
}
