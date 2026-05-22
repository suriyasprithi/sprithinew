<?php

namespace App\Commands;

use App\Models\MonthlyGlobalDistributionModel;
use App\Models\MonthlyGlobalPoolModel;
use App\Services\WalletService;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Distribute a single month's global pool to eligible inactive customers.
 *
 *   php spark pool:distribute           # defaults to previous calendar month
 *   php spark pool:distribute 2026-03   # specific period
 *
 * Eligibility: customer (role='customer', status='active') with NO row in
 * wallet_transactions whose created_at falls in the 3-month window
 * [first day of (period-2)] .. [last day of period].
 *
 * If no eligible customers, the month's collected balance rolls over into the
 * next month's pool (`collected += this.collected`), and this row is marked
 * distributed_at = now with distributed=0.
 *
 * Rounding: per_user_amount = floor(collected / eligible_count * 100) / 100.
 * Sub-paisa remainder (collected − distributed) is carried into next month's
 * collected as well.
 */
class PoolDistribute extends BaseCommand
{
    protected $group       = 'Pools';
    protected $name        = 'pool:distribute';
    protected $description = 'Distribute a monthly global pool to inactive customers (rolling 3-month window).';
    protected $usage       = 'pool:distribute [YYYY-MM]';
    protected $arguments   = ['period' => 'Calendar month YYYY-MM (default: previous month)'];

    public function run(array $params)
    {
        $period = $params[0] ?? CLI::getSegment(2) ?? null;
        if (! $period) {
            $period = date('Y-m', strtotime('first day of last month'));
        }
        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $period)) {
            CLI::error("Invalid period '{$period}'. Expected YYYY-MM, e.g. 2026-03.");
            return;
        }

        $pools = new MonthlyGlobalPoolModel();
        $dist  = new MonthlyGlobalDistributionModel();

        $row = $pools->where('period', $period)->first();
        if (! $row || (float) $row['collected'] <= 0) {
            CLI::write("No pool to distribute for {$period} (collected = " . ($row['collected'] ?? '0') . ').', 'yellow');
            return;
        }
        if (! empty($row['distributed_at'])) {
            CLI::write("Pool {$period} was already processed at {$row['distributed_at']}.", 'yellow');
            return;
        }

        // 3-month inactivity window: first day of (period-2) → last day of period.
        $windowStart = date('Y-m-01 00:00:00', strtotime("{$period}-01 -2 months"));
        $windowEnd   = date('Y-m-t 23:59:59', strtotime("{$period}-01"));

        $db = db_connect();

        // Eligible = active customers with zero wallet movements in window.
        $eligibleRows = $db->table('users u')
            ->select('u.id, u.name, u.mobile_number')
            ->where('u.role', 'customer')
            ->where('u.status', 'active')
            ->where("NOT EXISTS (SELECT 1 FROM wallet_transactions wt WHERE wt.user_id = u.id AND wt.created_at BETWEEN '{$windowStart}' AND '{$windowEnd}')", null, false)
            ->orderBy('u.id', 'ASC')
            ->get()
            ->getResultArray();

        $eligibleCount = count($eligibleRows);
        $collected     = (float) $row['collected'];

        CLI::write("Period:    {$period}", 'white');
        CLI::write("Window:    {$windowStart} → {$windowEnd}", 'white');
        CLI::write("Collected: ₹" . number_format($collected, 2), 'white');
        CLI::write("Eligible:  {$eligibleCount} customer(s)", 'white');

        // Zero-eligible → roll forward to next month
        if ($eligibleCount === 0) {
            $nextPeriod = date('Y-m', strtotime("{$period}-01 +1 month"));
            $pools->add($nextPeriod, $collected);
            $pools->update($row['id'], [
                'distributed'     => 0,
                'eligible_count'  => 0,
                'per_user_amount' => 0,
                'distributed_at'  => date('Y-m-d H:i:s'),
                'notes'           => trim(($row['notes'] ?? '') . " | no eligibles — rolled ₹" . number_format($collected, 2) . " to {$nextPeriod}"),
            ]);
            CLI::write("No eligibles. ₹" . number_format($collected, 2) . " rolled over to {$nextPeriod}.", 'green');
            return;
        }

        // Floor to 2 dp to avoid over-distribution
        $perUser  = floor($collected / $eligibleCount * 100) / 100;
        $payout   = round($perUser * $eligibleCount, 2);
        $leftover = round($collected - $payout, 2);

        if ($perUser <= 0) {
            CLI::write("Per-user amount rounded to ₹0 (collected too small for eligibles). Rolling forward.", 'yellow');
            $nextPeriod = date('Y-m', strtotime("{$period}-01 +1 month"));
            $pools->add($nextPeriod, $collected);
            $pools->update($row['id'], [
                'distributed'     => 0,
                'eligible_count'  => $eligibleCount,
                'per_user_amount' => 0,
                'distributed_at'  => date('Y-m-d H:i:s'),
                'notes'           => trim(($row['notes'] ?? '') . " | per-user rounds to 0 — rolled ₹" . number_format($collected, 2) . " to {$nextPeriod}"),
            ]);
            return;
        }

        // Credit each eligible user via WalletService (also writes wallet_transactions row).
        $wallet = new WalletService();
        $now    = date('Y-m-d H:i:s');
        $ref    = "global#{$period}";

        foreach ($eligibleRows as $u) {
            $wallet->credit((int) $u['id'], 'global', $perUser, 'global_pool', $ref, "Global pool {$period}");
            $dist->insert([
                'pool_id' => (int) $row['id'],
                'user_id' => (int) $u['id'],
                'amount'  => $perUser,
            ]);
        }

        $notes = "Distributed ₹" . number_format($perUser, 2) . " × {$eligibleCount}";
        if ($leftover > 0) {
            $nextPeriod = date('Y-m', strtotime("{$period}-01 +1 month"));
            $pools->add($nextPeriod, $leftover);
            $notes .= ". Leftover ₹" . number_format($leftover, 2) . " carried to {$nextPeriod}";
        }

        $pools->update($row['id'], [
            'distributed'     => $payout,
            'eligible_count'  => $eligibleCount,
            'per_user_amount' => $perUser,
            'distributed_at'  => $now,
            'notes'           => trim(($row['notes'] ?? '') . " | " . $notes),
        ]);

        CLI::write("✓ Distributed ₹" . number_format($perUser, 2) . " to {$eligibleCount} customer(s). Total paid ₹" . number_format($payout, 2) . ".", 'green');
        if ($leftover > 0) CLI::write("Leftover ₹" . number_format($leftover, 2) . " rolled to next month.", 'cyan');
    }
}
