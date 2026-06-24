<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Give wallet_transactions a first-class `wallet` column.
 *
 * Until now the wallet a row belongs to was encoded ONLY inside the free-text
 * `notes` ([+wallet]/[-wallet]/[legacy …] tags). The history endpoint had to
 * reconstruct it by string-matching, so any row whose notes lacked a tag was
 * invisible and its amount never reconciled with the wallet_balance columns.
 *
 * This column makes the wallet explicit. WalletService now stamps it on every
 * credit/debit; the `wallet:backfill` command populates it for existing rows.
 */
class AddWalletColumnToWalletTransactions extends Migration
{
    public function up()
    {
        if (! $this->db->fieldExists('wallet', 'wallet_transactions')) {
            $this->forge->addColumn('wallet_transactions', [
                'wallet' => [
                    'type'       => 'VARCHAR',
                    'constraint' => 20,
                    'null'       => true,
                    'after'      => 'type',
                ],
            ]);
        }
        // Index it — history queries filter by (user_id, wallet).
        try {
            $this->db->query('CREATE INDEX idx_wt_user_wallet ON wallet_transactions (user_id, wallet)');
        } catch (\Throwable $e) {
            // index already exists — ignore
        }
    }

    public function down()
    {
        try { $this->db->query('DROP INDEX idx_wt_user_wallet ON wallet_transactions'); } catch (\Throwable $e) {}
        if ($this->db->fieldExists('wallet', 'wallet_transactions')) {
            $this->forge->dropColumn('wallet_transactions', 'wallet');
        }
    }
}
