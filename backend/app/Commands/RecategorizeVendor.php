<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Move a vendor to a different vendor category and cascade it correctly:
 *   1. the vendor profile's vendor_category_id
 *   2. ALL of that vendor's products' vendor_category_id
 *   3. re-link every product category those products use to its new MAJORITY
 *      vendor category — so the customer sidebar groups it correctly.
 *
 * Use it to fix a grocery vendor wrongly profiled as "Textiles & Readymade":
 *   php spark vendor:recategorize 10287 Supermarket --dry-run
 *   php spark vendor:recategorize 10287 Supermarket
 *   php spark vendor:recategorize 10287 38            # target by id
 */
class RecategorizeVendor extends BaseCommand
{
    protected $group       = 'Maintenance';
    protected $name        = 'vendor:recategorize';
    protected $description = "Move a vendor to another vendor category and cascade profile + products + category links.";
    protected $usage       = 'vendor:recategorize <vendor_id> <vendor_category id|name> [--dry-run]';
    protected $options     = ['--dry-run' => 'Report the changes without applying them'];

    public function run(array $params)
    {
        $dry      = array_key_exists('dry-run', $params) || CLI::getOption('dry-run') !== null;
        $args     = array_values(array_filter($params, static fn ($p) => strpos((string) $p, '--') !== 0));
        $vendorId = (int) ($args[0] ?? 0);
        $target   = trim((string) ($args[1] ?? ''));
        if ($vendorId <= 0 || $target === '') {
            CLI::error('Usage: vendor:recategorize <vendor_id> <vendor_category id|name> [--dry-run]');
            return;
        }

        $db = \Config\Database::connect();

        // Resolve target vendor category (by id or name, case-insensitive).
        $vcRow = ctype_digit($target)
            ? $db->table('vendor_categories')->where('id', (int) $target)->get()->getRowArray()
            : $db->table('vendor_categories')->where('LOWER(name)', mb_strtolower($target))->get()->getRowArray();
        if (! $vcRow) { CLI::error("Vendor category \"{$target}\" not found."); return; }
        $vcId   = (int) $vcRow['id'];
        $vcName = (string) $vcRow['name'];

        $vp = $db->table('vendor_profiles')->where('user_id', $vendorId)->get()->getRowArray();
        if (! $vp) { CLI::error("No vendor profile for user #{$vendorId}."); return; }

        $curVc = (int) ($vp['vendor_category_id'] ?? 0);
        $prods = (int) $db->table('products')->where('vendor_id', $vendorId)->countAllResults();
        CLI::write("Vendor #{$vendorId} ({$vp['shop_name']}): vendor_category {$curVc} → {$vcId} ({$vcName})");
        CLI::write("  products to move: {$prods}");

        // Categories this vendor's products use (to re-link afterwards).
        $catIds = array_column(
            $db->table('products')->select('category_id')->where('vendor_id', $vendorId)
               ->where('category_id IS NOT NULL')->distinct()->get()->getResultArray(),
            'category_id'
        );

        // Everything runs inside one transaction so the category-majority is
        // computed AFTER the product move (accurate in dry-run too); dry-run
        // rolls the whole thing back at the end so nothing is persisted.
        $db->transBegin();
        $db->table('vendor_profiles')->where('user_id', $vendorId)->update(['vendor_category_id' => $vcId]);
        $db->table('products')->where('vendor_id', $vendorId)->update(['vendor_category_id' => $vcId]);

        $relinked = 0;
        foreach ($catIds as $cid) {
            $cid = (int) $cid;
            $maj = $db->query(
                'SELECT vendor_category_id, COUNT(*) n FROM products
                 WHERE category_id = ? AND vendor_category_id IS NOT NULL AND deleted_at IS NULL
                 GROUP BY vendor_category_id ORDER BY n DESC LIMIT 1',
                [$cid]
            )->getRowArray();
            if (! $maj) continue;
            $newVc = (int) $maj['vendor_category_id'];
            $cat   = $db->table('categories')->where('id', $cid)->get()->getRowArray();
            if ($cat && (int) ($cat['vendor_category_id'] ?? 0) !== $newVc) {
                CLI::write("  category #{$cid} \"{$cat['name']}\" → vc {$newVc}");
                $db->table('categories')->where('id', $cid)->update(['vendor_category_id' => $newVc]);
                $relinked++;
            }
        }

        if ($dry || $db->transStatus() === false) { $db->transRollback(); }
        else { $db->transCommit(); }

        CLI::write($dry
            ? "DRY-RUN: would move vendor + {$prods} products and re-link {$relinked} categories (nothing applied)."
            : "Done: vendor + {$prods} products moved; {$relinked} categories re-linked.",
            'green');
    }
}
