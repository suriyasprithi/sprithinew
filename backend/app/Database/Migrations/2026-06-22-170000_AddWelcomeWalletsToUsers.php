<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Welcome (signup referral) bonus gets its OWN wallet per upline depth, split
 * out from the freely-transferable purchase-commission level_N wallets.
 *
 *   level_1/2/3_wallet  → purchase MLM commission   → free transfer (unchanged)
 *   welcome_1/2/3_wallet → signup referral bonus     → gated by depth-N referral
 *                                                       count (100 / 10k / 10 lakh)
 *
 * Historical balances already in level_N stay there (decision A): only NEW
 * welcome bonuses land in the welcome wallets, so this is a clean cutover with
 * no risky reconstruction.
 *
 * Also bumps the L3 unlock threshold default 100000 → 1000000 (10 lakh) to match
 * the 100-per-person depth tree (100 → 10,000 → 10,00,000).
 */
class AddWelcomeWalletsToUsers extends Migration
{
    public function up()
    {
        $cols = [];
        foreach (['welcome_1_wallet', 'welcome_2_wallet', 'welcome_3_wallet'] as $col) {
            if (! $this->db->fieldExists($col, 'users')) {
                $cols[$col] = ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0.00];
            }
        }
        if ($cols) {
            $this->forge->addColumn('users', $cols);
        }

        // L3 threshold: 1 lakh → 10 lakh (only if it's still the old default, so a
        // hand-tuned value isn't clobbered).
        $this->db->query(
            "UPDATE system_settings SET value = '1000000'
             WHERE setting_key = 'level.unlock_threshold_3' AND value = '100000'"
        );
        // Ensure the three thresholds exist even on DBs that missed the seed.
        foreach ([
            'level.unlock_threshold_1' => '100',
            'level.unlock_threshold_2' => '10000',
            'level.unlock_threshold_3' => '1000000',
        ] as $k => $v) {
            $exists = (int) ($this->db->query(
                'SELECT COUNT(*) c FROM system_settings WHERE setting_key = ?', [$k]
            )->getRow()->c ?? 0);
            if ($exists === 0) {
                $this->db->query('INSERT INTO system_settings (setting_key, value) VALUES (?, ?)', [$k, $v]);
            }
        }
    }

    public function down()
    {
        foreach (['welcome_1_wallet', 'welcome_2_wallet', 'welcome_3_wallet'] as $col) {
            if ($this->db->fieldExists($col, 'users')) {
                $this->forge->dropColumn('users', $col);
            }
        }
    }
}
