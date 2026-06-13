<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Withdrawal requests (new schema, distinct from the legacy `withdraw` table).
 * Mirrors App\Models\WithdrawalModel — a user requests a payout, admin
 * approves/rejects. `details_json` snapshots the bank/UPI target at request
 * time so the admin's payout preview is unaffected by later profile edits.
 */
class CreateWithdrawalsTable extends Migration
{
    public function up()
    {
        if ($this->db->tableExists('withdrawals')) return;

        $this->forge->addField([
            'id'           => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'      => ['type' => 'BIGINT', 'unsigned' => true],
            'amount'       => ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0],
            'method'       => ['type' => 'VARCHAR', 'constraint' => 20],
            'details_json' => ['type' => 'TEXT', 'null' => true],
            'status'       => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'pending'],
            'processed_by' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'notes'        => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'created_at'   => ['type' => 'DATETIME', 'null' => true],
            'updated_at'   => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('user_id');
        $this->forge->addKey('status');
        $this->forge->createTable('withdrawals');
    }

    public function down()
    {
        $this->forge->dropTable('withdrawals', true);
    }
}
