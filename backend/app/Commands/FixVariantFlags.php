<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Clear the phantom-variant flag on products that were imported with
 * has_variants=1 but no selectable variant_types (no Color/Size axes).
 *
 *   php spark products:fix-variant-flags           # dry run — report only
 *   php spark products:fix-variant-flags --apply   # set has_variants=0 for real
 *
 * Background: the CSV product import created a metadata-only "variant" row per
 * product (it parks measure/mrp/discount/commission in the row's options) and
 * set has_variants=1, but never wrote variant_types. The customer page can't
 * render any chips to pick (it gates on variant_types), so it adds without a
 * variation_id — and CartController then rejects it with "Please select a
 * variant". Flipping these to has_variants=0 turns them back into simple
 * products that add to cart using the product-level price/stock.
 *
 * Only products with NO variant_types are touched, so real variant products are
 * never affected. The leftover variant rows are left in place (inert once the
 * flag is off) — nothing is deleted, so this is fully reversible:
 *   UPDATE products SET has_variants=1 WHERE id=<id>;
 */
class FixVariantFlags extends BaseCommand
{
    protected $group       = 'Products';
    protected $name        = 'products:fix-variant-flags';
    protected $description = 'Clear has_variants on products that have no selectable variant_types so they add to cart as simple products.';
    protected $usage       = 'products:fix-variant-flags [--apply]';
    protected $options     = [
        '--apply' => 'Perform the changes (default is a dry run).',
    ];

    public function run(array $params)
    {
        $apply = array_key_exists('apply', $params) || CLI::getOption('apply');

        $db = db_connect();

        // Products flagged as variant products but carrying no variant axes.
        $rows = $db->query(
            "SELECT p.id, p.name, p.stock AS prod_stock,
                    COUNT(v.id) AS active_variants, COALESCE(SUM(v.stock),0) AS variant_stock
             FROM products p
             LEFT JOIN product_variants v ON v.product_id = p.id AND v.status = 'active'
             WHERE p.has_variants = 1
               AND (p.variant_types IS NULL OR TRIM(p.variant_types) IN ('', '[]', '{}'))
             GROUP BY p.id, p.name, p.stock
             ORDER BY p.id"
        )->getResultArray();

        if (! $rows) { CLI::write('No phantom-variant products found. Nothing to fix.', 'green'); return; }

        CLI::write($apply ? 'APPLYING variant-flag cleanup…' : 'DRY RUN — no changes will be made. Re-run with --apply to act.', $apply ? 'yellow' : 'cyan');
        CLI::write('');

        foreach ($rows as $r) {
            CLI::write(sprintf(
                '  id=%-6d stock=%-4d variants=%d(stock=%d)  %s',
                $r['id'], $r['prod_stock'], $r['active_variants'], $r['variant_stock'], $r['name']
            ), 'white');
        }
        CLI::write('');
        CLI::write('Products to flip to has_variants=0: ' . count($rows), 'yellow');

        if (! $apply) {
            CLI::write('');
            CLI::write('Dry run complete. Re-run with --apply to clear the flag on these products.', 'cyan');
            return;
        }

        $ids = array_map(static fn ($r) => (int) $r['id'], $rows);

        $db->transStart();
        $db->table('products')->whereIn('id', $ids)->update(['has_variants' => 0]);
        $updated = $db->affectedRows();
        $db->transComplete();

        if ($db->transStatus() === false) {
            CLI::error('Transaction failed — rolled back, no changes made.');
            return;
        }

        CLI::write('');
        CLI::write("Done. Cleared has_variants on {$updated} product(s); they now add to cart as simple products.", 'green');
        CLI::write('Reverse one: UPDATE products SET has_variants=1 WHERE id=<id>;', 'cyan');
    }
}
