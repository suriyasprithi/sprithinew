<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * wallet_transactions is part of spec §11.11 (Phase 3 in §14).
 * Pulled into Phase 1 because the welcome-bonus decision (D4-A) requires
 * an audit row at signup time so admin can see count + total of bonuses given.
 */
class CreateWalletTransactionsTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'            => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'       => ['type' => 'BIGINT', 'unsigned' => true],
            'peer_user_id'  => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'amount'        => ['type' => 'DECIMAL', 'constraint' => '12,2'],
            'type'          => ['type' => 'VARCHAR', 'constraint' => 40],
            'reference'     => ['type' => 'VARCHAR', 'constraint' => 80, 'null' => true],
            'notes'         => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'created_at'    => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey('user_id');
        $this->forge->addKey('type');
        $this->forge->addKey('peer_user_id');
        $this->forge->createTable('wallet_transactions');
    }

    public function down()
    {
        $this->forge->dropTable('wallet_transactions', true);
    }
}
