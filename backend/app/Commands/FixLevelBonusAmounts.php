<?php

namespace App\Commands;

use App\Models\SystemSettingsModel;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * One-time fix: app signups before this patch stored referrals.bonus_amount = 0
 * for L2/L3, so the activity feed / total_bonus under-reported them even though
 * WelcomeBonusService credited the L2/L3 wallets. Backfills those rows to the
 * configured welcome.bonus_l2 / welcome.bonus_l3 amounts.
 *
 *   php spark referrals:fix-level-bonus
 *
 * Safe + idempotent: only touches L2/L3 rows whose bonus_amount is still 0
 * (legacy rows already carry the right amount, so they're untouched).
 */
class FixLevelBonusAmounts extends BaseCommand
{
    protected $group       = 'Maintenance';
    protected $name        = 'referrals:fix-level-bonus';
    protected $description = 'Backfill referrals.bonus_amount for L2/L3 rows left at 0 by old signups.';

    public function run(array $params)
    {
        $s   = new SystemSettingsModel();
        $l2  = (float) $s->get('welcome.bonus_l2', '10');
        $l3  = (float) $s->get('welcome.bonus_l3', '5');
        $db  = db_connect();

        CLI::write("Welcome bonus: L2={$l2}, L3={$l3}", 'white');

        $db->query('UPDATE `referrals` SET `bonus_amount` = ? WHERE `level` = 2 AND `bonus_amount` = 0', [$l2]);
        $n2 = $db->affectedRows();
        $db->query('UPDATE `referrals` SET `bonus_amount` = ? WHERE `level` = 3 AND `bonus_amount` = 0', [$l3]);
        $n3 = $db->affectedRows();

        CLI::write("Updated L2 rows: {$n2}, L3 rows: {$n3}", 'green');
    }
}
