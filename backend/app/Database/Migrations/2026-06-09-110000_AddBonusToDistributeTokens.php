<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Store the request-approval bonus as its own number on the ledger so the
 * UI can show a "Bonus earned" total without parsing the notes string.
 * 0 for ordinary distribute/gift rows.
 */
class AddBonusToDistributeTokens extends Migration
{
    public function up()
    {
        $this->forge->addColumn('distribute_tokens', [
            'bonus' => [
                'type'       => 'DECIMAL',
                'constraint' => '12,2',
                'default'    => 0,
                'after'      => 'tokens',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('distribute_tokens', 'bonus');
    }
}
