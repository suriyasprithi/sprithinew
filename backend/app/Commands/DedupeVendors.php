<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Phase 1 vendor de-duplication: neutralise duplicate vendor accounts so
 * customers only ever see/buy from the one real shop per name.
 *
 *   php spark vendors:dedupe              # dry run — report only, no changes
 *   php spark vendors:dedupe --apply      # block the duplicates for real
 *   php spark vendors:dedupe --exclude=10274,10261   # never touch these ids
 *
 * "Duplicate" = active, non-deleted vendors that share the exact same name.
 * Within each group the CANONICAL (kept) account is the one with the most
 * orders, then most products, then biggest wallet, then lowest id. Every other
 * account in the group is BLOCKED (status='blocked') and its active products
 * are set inactive — both reversible, and no data or wallet money is moved.
 *
 * Reverse a single account:
 *   UPDATE users SET status='active' WHERE id=<id>;
 *   UPDATE products SET status='active' WHERE vendor_id=<id> AND status='inactive';
 */
class DedupeVendors extends BaseCommand
{
    protected $group       = 'Vendors';
    protected $name        = 'vendors:dedupe';
    protected $description = 'Block duplicate vendor accounts (same name) so only the real shop stays live.';
    protected $usage       = 'vendors:dedupe [--apply] [--exclude=id,id]';
    protected $options     = [
        '--apply'   => 'Perform the changes (default is a dry run).',
        '--exclude' => 'Comma-separated vendor ids to leave untouched.',
    ];

    public function run(array $params)
    {
        $apply   = array_key_exists('apply', $params) || CLI::getOption('apply');
        $exclude = array_filter(array_map('intval', explode(',', (string) (CLI::getOption('exclude') ?? ''))));
        $exclude = array_flip($exclude); // id => true for O(1) lookup

        $db = db_connect();

        // Duplicate name-groups among live vendors.
        $groups = $db->query(
            "SELECT name, COUNT(*) n
             FROM users
             WHERE role='vendor' AND status='active' AND deleted_at IS NULL
             GROUP BY name HAVING n > 1 ORDER BY name"
        )->getResultArray();

        if (! $groups) { CLI::write('No duplicate vendor names found.', 'green'); return; }

        CLI::write($apply ? 'APPLYING vendor de-duplication…' : 'DRY RUN — no changes will be made. Re-run with --apply to act.', $apply ? 'yellow' : 'cyan');
        CLI::write('');

        $toBlock = [];   // [id => name]
        foreach ($groups as $g) {
            $name = $g['name'];
            $accounts = $db->query(
                "SELECT u.id, u.mobile_number, u.wallet_balance,
                        (SELECT COUNT(*) FROM products p WHERE p.vendor_id=u.id) AS products,
                        (SELECT COUNT(*) FROM products p WHERE p.vendor_id=u.id AND p.status='active') AS active_products,
                        (SELECT COUNT(*) FROM orders o WHERE o.vendor_id=u.id) AS orders,
                        (SELECT COUNT(*) FROM device_tokens d WHERE d.user_id=u.id) AS devices
                 FROM users u
                 WHERE u.role='vendor' AND u.status='active' AND u.deleted_at IS NULL AND u.name=?
                 ORDER BY u.id",
                [$name]
            )->getResultArray();

            // Rank: most orders, then products, then wallet, then lowest id.
            usort($accounts, static function ($a, $b) {
                return [(int) $b['orders'], (int) $b['products'], (float) $b['wallet_balance'], (int) $a['id']]
                   <=> [(int) $a['orders'], (int) $a['products'], (float) $a['wallet_balance'], (int) $b['id']];
            });

            CLI::write("Group: \"{$name}\"", 'white');
            foreach ($accounts as $i => $a) {
                $excluded = isset($exclude[(int) $a['id']]);
                $isKeep   = $i === 0 || $excluded;
                $tag      = $excluded ? 'EXCLUDED' : ($i === 0 ? 'KEEP' : 'BLOCK');
                $color    = $tag === 'KEEP' ? 'green' : ($tag === 'BLOCK' ? 'red' : 'yellow');
                CLI::write(sprintf(
                    "  [%-8s] id=%-6d mob=%-12s wallet=%-10s products=%d(active=%d) orders=%d devices=%d",
                    $tag, $a['id'], $a['mobile_number'], $a['wallet_balance'],
                    $a['products'], $a['active_products'], $a['orders'], $a['devices']
                ), $color);
                if (! $isKeep) $toBlock[(int) $a['id']] = $name;
            }
            // Warn about any money parked on accounts we're about to block.
            foreach ($accounts as $i => $a) {
                if ($i > 0 && ! isset($exclude[(int) $a['id']]) && (float) $a['wallet_balance'] > 0) {
                    CLI::write("    note: id={$a['id']} keeps a parked wallet of ₹{$a['wallet_balance']} (Phase 1 doesn't move money).", 'yellow');
                }
            }
            CLI::write('');
        }

        if (! $toBlock) { CLI::write('Nothing to block after exclusions.', 'green'); return; }

        CLI::write('Accounts to block: ' . implode(', ', array_keys($toBlock)), 'yellow');

        if (! $apply) {
            CLI::write('');
            CLI::write('Dry run complete. Re-run with --apply to block these accounts.', 'cyan');
            return;
        }

        // Apply, transactionally.
        $db->transStart();
        $blocked = 0; $deactivated = 0;
        foreach (array_keys($toBlock) as $id) {
            $db->table('users')->where('id', $id)->update(['status' => 'blocked']);
            $blocked++;
            $db->table('products')->where('vendor_id', $id)->where('status', 'active')->update(['status' => 'inactive']);
            $deactivated += $db->affectedRows();
        }
        $db->transComplete();

        if ($db->transStatus() === false) {
            CLI::error('Transaction failed — rolled back, no changes made.');
            return;
        }
        CLI::write('');
        CLI::write("Done. Blocked {$blocked} account(s), deactivated {$deactivated} product(s).", 'green');
        CLI::write('Reverse an account: UPDATE users SET status=\'active\' WHERE id=<id>; and re-activate its products.', 'cyan');
    }
}
