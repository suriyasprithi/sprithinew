<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Two earmarked reserves held on the main-admin user row (NOT the spendable
 * main wallet):
 *   - buyback_reserve : unused/surplus buyback that auto-draws to fill cycles.
 *   - level_reserve   : orphan L1/L2/L3 commission (buyer had no upline).
 * Both are credited by CommissionService so the admin's main wallet only ever
 * holds its legitimate slices (global + lucky + token + admin base + deltas).
 */
class AddReserveWalletsToUsers extends Migration
{
    public function up()
    {
        $fields = [];
        if (! $this->db->fieldExists('buyback_reserve', 'users')) {
            $fields['buyback_reserve'] = ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0, 'after' => 'qr_wallet'];
        }
        if (! $this->db->fieldExists('level_reserve', 'users')) {
            $fields['level_reserve'] = ['type' => 'DECIMAL', 'constraint' => '12,2', 'default' => 0, 'after' => 'qr_wallet'];
        }
        if ($fields) $this->forge->addColumn('users', $fields);
    }

    public function down()
    {
        foreach (['buyback_reserve', 'level_reserve'] as $col) {
            if ($this->db->fieldExists($col, 'users')) $this->forge->dropColumn('users', $col);
        }
    }
}
