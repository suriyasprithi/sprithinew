<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * One-time: fold every user's `token_balance` into `wallet_balance` (1 token =
 * ₹1) and zero the token_balance, because token == main wallet now. The token
 * economy (see App\Services\TokenService) no longer reads/writes token_balance.
 *
 *   php spark tokens:merge-to-wallet [--dry-run]
 *
 * Idempotent — once a row's token_balance is 0 it's skipped, so re-running is safe.
 */
class MergeTokensToWallet extends BaseCommand
{
    protected $group       = 'Maintenance';
    protected $name        = 'tokens:merge-to-wallet';
    protected $description  = 'Fold token_balance into wallet_balance (token = main wallet, 1 token = ₹1).';
    protected $usage       = 'tokens:merge-to-wallet [--dry-run]';
    protected $options     = ['--dry-run' => 'Report only; do not write.'];

    public function run(array $params)
    {
        $dry = CLI::getOption('dry-run') !== null;
        $db  = \Config\Database::connect();

        $rows = $db->table('users')
            ->select('id, name, role, token_balance, wallet_balance')
            ->where('token_balance <>', 0)
            ->get()->getResultArray();

        CLI::write(sprintf('%d user(s) with a non-zero token_balance.', count($rows)), 'cyan');
        $moved = 0.0;
        foreach ($rows as $r) {
            $tb = (float) $r['token_balance'];
            $wb = (float) $r['wallet_balance'];
            $new = round($wb + $tb, 2);
            $moved += $tb;
            CLI::write(sprintf('  id=%-6s %-20s token %s + wallet %s -> wallet %s', $r['id'], $r['name'], $tb, $wb, $new));
            if (! $dry) {
                $db->table('users')->where('id', $r['id'])->update([
                    'wallet_balance' => $new,
                    'token_balance'  => 0,
                ]);
            }
        }

        CLI::newLine();
        CLI::write(sprintf('%s %s tokens folded into wallets across %d user(s).',
            $dry ? '[DRY-RUN] would move' : 'Moved', $moved, count($rows)),
            count($rows) ? 'green' : 'white');
        if ($dry && $rows) CLI::write('Re-run without --dry-run to apply.', 'yellow');
    }
}
