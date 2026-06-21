<?php

namespace App\Commands;

use App\Models\OrderModel;
use App\Services\CommissionService;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Backfill: distribute commission/buyback for NON-COD orders that reached a paid
 * state but were never settled (e.g. payment_method NULL/online orders placed
 * before the "fire on paid" fix). Idempotent — distributeForOrder stamps
 * commission_distributed_at, so re-running is safe and skips already-settled rows.
 * COD orders are left alone (they settle on delivery). Legacy orders are skipped.
 */
class SettleCommissions extends BaseCommand
{
    protected $group       = 'Orders';
    protected $name        = 'orders:settle-commissions';
    protected $description = 'Distribute commission/buyback for non-COD paid orders that were never settled.';

    public function run(array $params)
    {
        $om  = new OrderModel();
        $svc = new CommissionService();
        $db  = \Config\Database::connect();
        $hasLegacyMap = $db->tableExists('legacy_id_map');

        $rows = $om
            ->whereIn('status', ['paid', 'shipped', 'delivered'])
            ->where('commission_distributed_at', null)
            ->groupStart()
                ->where('payment_method !=', 'cod')
                ->orWhere('payment_method', null)
            ->groupEnd()
            ->orderBy('id', 'ASC')
            ->findAll();

        CLI::write('Candidate non-COD unsettled orders: ' . count($rows), 'yellow');
        $settled = 0; $legacy = 0;

        foreach ($rows as $o) {
            $id = (int) $o['id'];
            if ($hasLegacyMap) {
                $isLegacy = (bool) $db->table('legacy_id_map')->where('old_table', 'order')->where('new_id', $id)->countAllResults();
                if ($isLegacy) { $legacy++; continue; }
            }
            $svc->distributeForOrder(
                $id,
                (int) $o['customer_id'],
                (float) $o['total'],
                ! empty($o['vendor_id']) ? (int) $o['vendor_id'] : null,
            );
            $settled++;
            CLI::write("  settled order #{$id} (₹{$o['total']})", 'green');
        }

        CLI::write("Done. Settled {$settled}, skipped {$legacy} legacy.", 'green');
    }
}
