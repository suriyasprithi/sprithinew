<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Backfill orders whose vendor_id is NULL/0 by resolving it from the order's
 * items.
 *
 * An order loses its vendor_id at checkout when the cart mixed products from
 * more than one vendor *record* — e.g. the duplicate "same shop" accounts the
 * legacy import created (see vendors:dedupe). Once those duplicates are
 * collapsed to one active account per name, every such product resolves to the
 * SAME canonical vendor, so the order can be safely stamped with it.
 *
 *   php spark orders:fix-empty-vendor          # dry run — report only
 *   php spark orders:fix-empty-vendor --apply  # write the changes
 *
 * Run AFTER vendors:dedupe so each shop name has exactly one active account.
 * Orders whose items genuinely span two different shop names are left untouched.
 */
class FixEmptyOrderVendors extends BaseCommand
{
    protected $group       = 'Orders';
    protected $name        = 'orders:fix-empty-vendor';
    protected $description = 'Stamp vendor_id on orders that lost it to a mixed (duplicate-shop) cart.';
    protected $usage       = 'orders:fix-empty-vendor [--apply]';
    protected $options     = ['--apply' => 'Perform the changes (default is a dry run).'];

    public function run(array $params)
    {
        $apply = array_key_exists('apply', $params) || CLI::getOption('apply');
        $db    = db_connect();

        $orders = $db->query(
            'SELECT id FROM orders WHERE vendor_id IS NULL OR vendor_id = 0 ORDER BY id'
        )->getResultArray();
        if (! $orders) { CLI::write('No orders with an empty vendor_id.', 'green'); return; }

        CLI::write($apply ? 'APPLYING…' : 'DRY RUN — re-run with --apply to write.', $apply ? 'yellow' : 'cyan');
        CLI::write('');

        $fix = [];      // order_id => vendor_id
        $skipped = 0;
        foreach ($orders as $o) {
            $oid = (int) $o['id'];

            // Distinct canonical vendor (the one active, non-deleted account per
            // shop name) behind every item's product.
            $rows = $db->query(
                "SELECT DISTINCT canon.id AS vendor_id, canon.name
                 FROM order_items oi
                 JOIN products p  ON p.id = oi.product_id
                 JOIN users prodv ON prodv.id = p.vendor_id
                 JOIN users canon ON canon.name = prodv.name
                                 AND canon.role = 'vendor'
                                 AND canon.status = 'active'
                                 AND canon.deleted_at IS NULL
                 WHERE oi.order_id = ?",
                [$oid]
            )->getResultArray();

            $vendorIds = array_values(array_unique(array_map(static fn ($r) => (int) $r['vendor_id'], $rows)));
            if (count($vendorIds) === 1) {
                $fix[$oid] = $vendorIds[0];
                CLI::write(sprintf('  order #%-6d -> vendor %d (%s)', $oid, $vendorIds[0], $rows[0]['name']), 'green');
            } else {
                $skipped++;
                $reason = empty($vendorIds) ? 'no resolvable vendor' : 'items span ' . count($vendorIds) . ' shops';
                CLI::write(sprintf('  order #%-6d SKIP — %s', $oid, $reason), 'yellow');
            }
        }

        CLI::write('');
        CLI::write(sprintf('Resolvable: %d   Skipped: %d', count($fix), $skipped), 'white');

        if (! $apply) { CLI::write('Dry run complete. Re-run with --apply to write.', 'cyan'); return; }
        if (! $fix)   { CLI::write('Nothing to update.', 'green'); return; }

        $db->transStart();
        foreach ($fix as $oid => $vid) {
            $db->table('orders')->where('id', $oid)->update(['vendor_id' => $vid]);
        }
        $db->transComplete();
        if ($db->transStatus() === false) { CLI::error('Transaction failed — rolled back, no changes made.'); return; }

        CLI::write('Updated ' . count($fix) . ' order(s).', 'green');
    }
}
