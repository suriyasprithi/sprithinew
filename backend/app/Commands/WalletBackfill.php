<?php

namespace App\Commands;

use App\Services\WalletService;
use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Backfill wallet_transactions.wallet for rows created before the column
 * existed. Classification mirrors WalletController::history so the column
 * reproduces exactly what the string-matching showed — plus it rescues the
 * un-tagged rows the old logic dropped (so "old records" reappear and the
 * per-wallet totals reconcile with the balance columns).
 *
 *   php spark wallet:backfill          # DRY by default — report only, no writes
 *   php spark wallet:backfill apply    # actually write the wallet column
 *
 * Idempotent: every UPDATE is scoped to `wallet IS NULL`, so re-running it
 * only fills rows still missing a wallet. Default is DRY for safety on prod.
 */
class WalletBackfill extends BaseCommand
{
    protected $group       = 'Maintenance';
    protected $name        = 'wallet:backfill';
    protected $description = 'Populate wallet_transactions.wallet from notes/type for legacy rows.';

    public function run(array $params)
    {
        // Default to DRY for safety; require an explicit `apply` arg to write.
        $dry = ! in_array('apply', $params, true);
        $db  = db_connect();

        if (! $db->fieldExists('wallet', 'wallet_transactions')) {
            CLI::error('Column wallet_transactions.wallet does not exist. Run the migration first.');
            return;
        }

        $before = (int) $db->query("SELECT COUNT(*) c FROM wallet_transactions WHERE wallet IS NULL")->getRow()->c;
        CLI::write("Rows missing a wallet: {$before}", 'yellow');
        if ($dry) CLI::write('DRY RUN — no changes will be written.', 'yellow');

        // Each step returns affected-row count. In dry mode we only COUNT the
        // candidates so nothing is written.
        $step = function (string $label, string $set, string $cond, array $bind) use ($db, $dry) {
            if ($dry) {
                $n = (int) $db->query("SELECT COUNT(*) c FROM wallet_transactions WHERE wallet IS NULL AND ($cond)", $bind)->getRow()->c;
            } else {
                $db->query("UPDATE wallet_transactions SET wallet = $set WHERE wallet IS NULL AND ($cond)", $bind);
                $n = $db->affectedRows();
            }
            if ($n > 0) CLI::write(sprintf('  %-26s %6d', $label, $n), 'green');
            return $n;
        };

        // 1) Modern [+wallet] / [-wallet] tags — the authoritative signal.
        foreach (WalletService::WALLETS as $w) {
            $step("tag [{$w}]", '?', "notes LIKE ? OR notes LIKE ?", [$w, "%[+{$w}]%", "%[-{$w}]%"]);
        }

        // 2) Legacy commission income — "level N type M [legacy income]" → level_N.
        $step('legacy income L3', "'level_3'", "notes LIKE ? AND notes LIKE ?", ['%level 3 type%', '%[legacy income]%']);
        $step('legacy income L2', "'level_2'", "notes LIKE ? AND notes LIKE ?", ['%level 2 type%', '%[legacy income]%']);
        $step('legacy income L1', "'level_1'", "notes LIKE ?", ['%[legacy income]%']); // remainder

        // 3) Legacy main-wallet movements.
        $step('legacy withdraw/purchase', "'wallet'", "notes LIKE ? OR notes LIKE ?", ['%[legacy withdraw]%', '%[legacy purchase]%']);

        // 4) Un-tagged rows classified by transaction type.
        $step("type=receive → qr", "'qr'", "type = ?", ['receive']);                 // vendor QR sale credit
        $step("type=welcome_bonus", "'welcome_1'", "type = ?", ['welcome_bonus']);   // signup bonus
        $step("type=payment/withdraw/..", "'wallet'", "type IN (?, ?, ?, ?)", ['payment', 'withdraw', 'debit', 'credit']);

        $after = (int) $db->query("SELECT COUNT(*) c FROM wallet_transactions WHERE wallet IS NULL")->getRow()->c;
        CLI::write('', 'white');
        CLI::write("Still NULL after backfill: {$after}", $after > 0 ? 'yellow' : 'green');
        if ($after > 0) {
            CLI::write("  (these stay NULL — history falls back to note-matching for them)", 'white');
            $rows = $db->query("SELECT type, COUNT(*) c FROM wallet_transactions WHERE wallet IS NULL GROUP BY type ORDER BY c DESC LIMIT 10")->getResultArray();
            foreach ($rows as $r) CLI::write(sprintf('    %-16s %6d', $r['type'], $r['c']), 'white');
        }
        CLI::write($dry ? 'Dry run complete.' : 'Backfill complete.', 'green');
    }
}
