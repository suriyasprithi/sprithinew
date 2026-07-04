<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Models\CategoryModel;
use App\Models\ProductModel;
use App\Models\VendorProfileModel;

/**
 * Re-point an existing vendor's products to categories SCOPED to the vendor's
 * vendor_category — the same rule the import now uses. For each product, its
 * category (by name + parent) is resolved to a category owned by the vendor's
 * vendor_category (created/adopted if needed) and the product is re-pointed. Also
 * aligns the product's vendor_category_id. Fixes products imported before the
 * scoped-category fix (e.g. a Supermarket shop whose "Grocery" products sit under
 * "Textiles & Readymade" in the customer category sidebar).
 *
 *   php spark products:rescope-categories 10287 --dry-run
 *   php spark products:rescope-categories 10287
 */
class RescopeVendorCategories extends BaseCommand
{
    protected $group       = 'Maintenance';
    protected $name        = 'products:rescope-categories';
    protected $description = "Re-point a vendor's products to categories scoped to their vendor_category.";
    protected $usage       = 'products:rescope-categories <vendor_id> [--dry-run]';
    protected $options     = ['--dry-run' => 'Report the changes without applying them'];

    public function run(array $params)
    {
        $dry      = array_key_exists('dry-run', $params) || CLI::getOption('dry-run') !== null;
        $args     = array_values(array_filter($params, static fn ($p) => strpos((string) $p, '--') !== 0));
        $vendorId = (int) ($args[0] ?? 0);
        if ($vendorId <= 0) { CLI::error('Usage: products:rescope-categories <vendor_id> [--dry-run]'); return; }

        $vp = (new VendorProfileModel())->where('user_id', $vendorId)->first();
        if (! $vp) { CLI::error("No vendor profile for user #{$vendorId}."); return; }
        $vcId = (int) ($vp['vendor_category_id'] ?? 0);
        if ($vcId <= 0) { CLI::error("Vendor #{$vendorId} has no vendor_category set on its profile."); return; }
        CLI::write("Vendor #{$vendorId} ({$vp['shop_name']}) → scope categories to vendor_category {$vcId}");

        $cm = new CategoryModel();

        // Build the same owned/unowned maps the import resolver uses.
        $owned = []; $unowned = []; $byId = [];
        foreach ($cm->findAll() as $c) {
            $byId[(int) $c['id']] = $c;
            $pid = isset($c['parent_id']) && $c['parent_id'] !== null ? (int) $c['parent_id'] : 0;
            $vc  = isset($c['vendor_category_id']) && $c['vendor_category_id'] !== null ? (int) $c['vendor_category_id'] : 0;
            $nm  = mb_strtolower(trim((string) $c['name']));
            if ($vc > 0) $owned[$vc . '|' . $pid . '|' . $nm] = (int) $c['id'];
            else         $unowned[$pid . '|' . $nm] = (int) $c['id'];
        }
        $resolve = static function (string $name, int $parentId) use (&$owned, &$unowned, $cm, $vcId, $dry): int {
            $nm = mb_strtolower(trim($name));
            if (isset($owned[$vcId . '|' . $parentId . '|' . $nm])) return $owned[$vcId . '|' . $parentId . '|' . $nm];
            $uk = $parentId . '|' . $nm;
            if (isset($unowned[$uk])) {
                $id = $unowned[$uk];
                if (! $dry) $cm->update($id, ['vendor_category_id' => $vcId]);
                $owned[$vcId . '|' . $parentId . '|' . $nm] = $id; unset($unowned[$uk]);
                return $id;
            }
            $id = $dry ? -1 : (int) $cm->insert(['name' => $name, 'parent_id' => $parentId ?: null, 'vendor_category_id' => $vcId, 'status' => 'active'], true);
            if (! $dry) $owned[$vcId . '|' . $parentId . '|' . $nm] = $id;
            return $id;
        };

        $pm = new ProductModel();
        $moved = 0; $vcFixed = 0; $per = 1000;
        for ($page = 0; $page < 5000; $page++) {
            $rows = $pm->select('id, category_id, vendor_category_id')->where('vendor_id', $vendorId)
                ->orderBy('id', 'ASC')->findAll($per, $page * $per);
            if (! $rows) break;
            foreach ($rows as $p) {
                $upd = [];
                $curCatId = (int) ($p['category_id'] ?? 0);
                if ($curCatId > 0 && isset($byId[$curCatId])) {
                    $cur    = $byId[$curCatId];
                    $curVc  = isset($cur['vendor_category_id']) && $cur['vendor_category_id'] !== null ? (int) $cur['vendor_category_id'] : 0;
                    if ($curVc !== $vcId) {   // category belongs to a different vendor_category → re-point
                        $pid   = isset($cur['parent_id']) && $cur['parent_id'] !== null ? (int) $cur['parent_id'] : 0;
                        $newId = $resolve((string) $cur['name'], $pid);
                        if ($newId > 0 && $newId !== $curCatId) { $upd['category_id'] = $newId; $moved++; }
                        elseif ($dry) $moved++;
                    }
                }
                if ((int) ($p['vendor_category_id'] ?? 0) !== $vcId) { $upd['vendor_category_id'] = $vcId; $vcFixed++; }
                if ($upd && ! $dry) $pm->update((int) $p['id'], $upd);
            }
        }

        CLI::write($dry
            ? "DRY-RUN: would re-point {$moved} products to scoped categories and set vendor_category on {$vcFixed} (nothing applied)."
            : "Done: {$moved} products re-pointed; vendor_category set on {$vcFixed}.",
            'green');
    }
}
