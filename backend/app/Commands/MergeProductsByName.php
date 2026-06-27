<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * Re-group products that the item_code-keyed import split apart: products whose
 * sizes each had their own code (MILKY MIST PANEER 200G/500G/110G) landed as
 * separate products. This folds same-(vendor, name) products into one parent
 * carrying every size as a variant — but ONLY when it is clearly safe.
 *
 * Detection rules (safety over aggressive merging — wrong merge = corruption):
 *   MERGE  — every variant value is a clear attribute (Size 100G, Volume 500ML,
 *            Color, Storage 128GB, RAM 8GB, clothing size S/M/L…) and the name
 *            carries no bundle/combo wording.
 *   REVIEW — mixed (some valid attributes + some not) OR any marketing/bundle
 *            word (combo, pack, gift, offer, premium, special, family pack…).
 *            Left as separate products for an admin to merge by hand.
 *   SKIP   — no valid attribute at all (price labels "30/-", bare numbers) —
 *            generic name collisions (TOY ×110, PLASTIC, FANCY).
 *
 * Dry-run by default (read-only). Pass --apply to merge the MERGE groups only.
 *   php spark products:merge-by-name [--apply] [--vendor=ID] [--name="..."]
 */
class MergeProductsByName extends BaseCommand
{
    protected $group       = 'Catalog';
    protected $name        = 'products:merge-by-name';
    protected $description = 'Safely merge same-(vendor,name) products into one with size variants; only clear attribute groups, never bundles. Dry-run unless --apply.';
    protected $usage       = 'products:merge-by-name [--apply] [--vendor=ID] [--name="..."]';

    /** Marketing / bundle words that make a group unsafe to auto-merge. */
    private const BUNDLE_WORDS = [
        'COMBO', 'BUNDLE', 'OFFER', 'GIFT', 'PREMIUM', 'SPECIAL PACK', 'FAMILY PACK',
        'ECONOMY PACK', 'COMBO PACK', 'VALUE PACK', 'TRIAL PACK', 'FESTIVAL PACK',
        'MULTIPACK', 'MULTI PACK', 'SAVER', 'JUMBO', 'HAMPER', 'PROMO', 'FREE GIFT',
    ];

    public function run(array $params)
    {
        $apply  = array_key_exists('apply', $params);
        $vendor = $params['vendor'] ?? CLI::getOption('vendor');
        $nameF  = $params['name']   ?? CLI::getOption('name');
        $show   = array_key_exists('verbose', $params) || ! $apply;

        $db = \Config\Database::connect();

        $gb = $db->table('products')
            ->select('vendor_id, name, COUNT(*) AS c')
            ->where('deleted_at', null)
            ->groupBy('vendor_id, name')
            ->having('c > 1');
        if ($vendor) $gb->where('vendor_id', (int) $vendor);
        if ($nameF)  $gb->where('name', $nameF);
        $groups = $gb->get()->getResultArray();

        $stat = ['merge' => 0, 'review' => 0, 'skip' => 0];
        $productsInMerge = 0;

        foreach ($groups as $g) {
            $rows = $db->table('products')
                ->where('vendor_id', (int) $g['vendor_id'])
                ->where('name', $g['name'])
                ->where('deleted_at', null)
                ->orderBy('id', 'ASC')
                ->get()->getResultArray();
            if (count($rows) < 2) continue;

            $ids      = array_map(static fn ($r) => (int) $r['id'], $rows);
            $variants = $db->table('product_variants')->whereIn('product_id', $ids)->get()->getResultArray();
            $optVals  = $this->optionValues($rows, $variants);

            [$action, $reason] = $this->classify($g['name'], $optVals);
            $stat[$action]++;

            if ($action === 'merge') {
                $productsInMerge += count($rows);
                if ($apply) $this->mergeGroup($db, $rows, $variants);
                if ($show) CLI::write(sprintf('MERGE  [%d] %-30s ×%-3d → %s',
                    $g['vendor_id'], $this->clip($g['name'], 30), $g['c'], $this->sample($optVals)), 'green');
            } elseif ($action === 'review') {
                if ($show) CLI::write(sprintf('REVIEW [%d] %-30s ×%-3d   %s {%s}',
                    $g['vendor_id'], $this->clip($g['name'], 30), $g['c'], $this->sample($optVals), $reason), 'yellow');
            } else {
                if ($show) CLI::write(sprintf('SKIP   [%d] %-30s ×%-3d   %s {%s}',
                    $g['vendor_id'], $this->clip($g['name'], 30), $g['c'], $this->sample($optVals), $reason), 'light_gray');
            }
        }

        CLI::newLine();
        CLI::write('===== ' . ($apply ? 'APPLIED' : 'DRY-RUN') . ' summary =====', 'white');
        CLI::write('Merge groups   : ' . $stat['merge'] . '  (' . $productsInMerge . ' products → ' . $stat['merge'] . ')', 'green');
        CLI::write('Needs review   : ' . $stat['review'], 'yellow');
        CLI::write('Skipped generic: ' . $stat['skip'], 'light_gray');
        if (! $apply && $stat['merge'] > 0) CLI::write('Re-run with --apply to merge the MERGE groups only.', 'cyan');
    }

    /** Decide merge / review / skip for a (name, variant-values) group. */
    private function classify(string $name, array $optVals): array
    {
        if ($this->nameHasBundle($name)) return ['review', 'bundle name'];
        if (! $optVals)                  return ['skip', 'no variant values'];

        $valid = $marketing = $other = 0;
        foreach ($optVals as $v) {
            if ($this->isAttribute($v))        $valid++;
            elseif ($this->isMarketing($v))    $marketing++;
            else                               $other++;
        }
        if ($marketing > 0)            return ['review', 'bundle/marketing value'];
        if ($valid === count($optVals)) return ['merge', ''];
        if ($valid > 0)                return ['review', 'mixed valid + unknown'];
        return ['skip', 'price-label/generic'];
    }

    /** A clean variant attribute: weight, volume, storage, length, count, clothing size, or color. */
    private function isAttribute(string $val): bool
    {
        $v = strtoupper(trim(str_replace('\\', '', $val)));
        if ($v === '') return false;
        $pats = [
            '/^\d+(\.\d+)?\s*(MG|G|GM|GMS|GRAM|GRAMS|KG|KGS)$/',           // weight
            '/^\d+(\.\d+)?\s*(ML|L|LT|LTR|LTRS|LITRE|LITER|LITRES)$/',     // volume
            '/^\d+(\.\d+)?\s*(MB|GB|TB)$/',                                // storage / RAM
            '/^\d+(\.\d+)?\s*(MM|CM|INCH|INCHES|FT|FEET)$/',               // length
            '/^\d+\s*(N|NO|NOS|PC|PCS|PCES|PIECE|PIECES|U|UNIT|UNITS|CT|COUNT|DOZEN)$/', // count
            '/^(XS|S|M|L|XL|XXL|3XL|XXXL|4XL|5XL|NB|NEWBORN|NEW BORN|FREE SIZE|FREESIZE|STD|STANDARD)(\s*[=:\-]\s*\d+)?$/', // clothing/diaper size (+ optional count)
        ];
        foreach ($pats as $p) if (preg_match($p, $v)) return true;
        $colors = ['RED','BLUE','BLACK','GREEN','WHITE','YELLOW','PINK','ORANGE','PURPLE','VIOLET','BROWN','GREY','GRAY','GOLD','GOLDEN','SILVER','MAROON','NAVY','BEIGE','CREAM','TAN','MULTI','MULTICOLOR','MULTICOLOUR','ASSORTED','ASST'];
        return in_array($v, $colors, true);
    }

    /** A marketing/bundle label (combo, pack, gift, offer, premium, special, …). */
    private function isMarketing(string $val): bool
    {
        $v = strtoupper(str_replace('\\', '', $val));
        foreach (self::BUNDLE_WORDS as $w) if (strpos($v, $w) !== false) return true;
        // Standalone "PACK" / "SET" / "SPECIAL" / "PREMIUM" / "OFFER" as a value.
        foreach (['PACK', 'SET', 'SPECIAL', 'PREMIUM', 'OFFER', 'COMBO', 'GIFT'] as $w) {
            if (preg_match('/\b' . $w . '\b/', $v)) return true;
        }
        return false;
    }

    private function nameHasBundle(string $name): bool
    {
        $n = strtoupper($name);
        foreach (self::BUNDLE_WORDS as $w) if (strpos($n, $w) !== false) return true;
        return false;
    }

    /** Collect every variant option label across the group. */
    private function optionValues(array $rows, array $variants): array
    {
        $vals = [];
        foreach ($variants as $v) {
            $opts = json_decode((string) ($v['options'] ?? ''), true);
            if (is_array($opts) && $opts) {
                foreach ($opts as $val) $vals[] = trim((string) $val);
            } elseif (! empty($v['name'])) {
                $vals[] = trim((string) $v['name']);
            }
        }
        if (! $vals) {
            foreach ($rows as $r) {
                $vt = json_decode((string) ($r['variant_types'] ?? ''), true);
                if (is_array($vt)) {
                    foreach ($vt as $axis) foreach (($axis['options'] ?? []) as $val) $vals[] = trim((string) $val);
                }
            }
        }
        return array_values(array_filter($vals, static fn ($s) => $s !== ''));
    }

    /** Fold the group into the lowest-id parent; soft-delete the rest. */
    private function mergeGroup($db, array $rows, array $variants): void
    {
        $parentId = (int) $rows[0]['id'];
        $childIds = [];
        foreach (array_slice($rows, 1) as $r) $childIds[] = (int) $r['id'];

        $db->transBegin();

        if ($childIds) $db->table('product_variants')->whereIn('product_id', $childIds)->update(['product_id' => $parentId]);

        // Products with no variant row of their own get a synthetic one so their size survives.
        $have = [];
        foreach ($variants as $v) $have[(int) $v['product_id']] = true;
        foreach ($rows as $r) {
            if (isset($have[(int) $r['id']])) continue;
            $vt = json_decode((string) ($r['variant_types'] ?? ''), true);
            $label = '';
            if (is_array($vt)) foreach ($vt as $axis) { if (! empty($axis['options'][0])) { $label = trim((string) $axis['options'][0]); break; } }
            if ($label === '') $label = 'Option ' . $r['id'];
            $db->table('product_variants')->insert([
                'product_id' => $parentId,
                'name'       => $label,
                'sku'        => ((string) ($r['code'] ?? $r['id'])) . '-' . $label,
                'options'    => json_encode(['size' => $label]),
                'price'      => (float) $r['price'],
                'stock'      => (int) ($r['stock'] ?? 0),
                'mrp'        => $r['mrp'] ?? null,
                'barcode'    => $r['barcode'] ?? null,
                'status'     => 'active',
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
        }

        $all = $db->table('product_variants')->where('product_id', $parentId)->get()->getResultArray();
        $axes = []; $prices = []; $stock = 0; $mrps = [];
        foreach ($all as $v) {
            $opts = json_decode((string) ($v['options'] ?? ''), true);
            if (is_array($opts) && $opts) {
                foreach ($opts as $k => $val) {
                    $k = (string) $k; $val = trim((string) $val);
                    if ($val === '') continue;
                    $axes[$k] ??= [];
                    if (! in_array($val, $axes[$k], true)) $axes[$k][] = $val;
                }
            } elseif (! empty($v['name'])) {
                $axes['size'] ??= [];
                if (! in_array($v['name'], $axes['size'], true)) $axes['size'][] = (string) $v['name'];
            }
            $prices[] = (float) $v['price'];
            $stock   += (int) ($v['stock'] ?? 0);
            if ($v['mrp'] !== null && $v['mrp'] !== '') $mrps[] = (float) $v['mrp'];
        }
        $variantTypes = [];
        foreach ($axes as $k => $vals) $variantTypes[] = ['name' => $k, 'options' => array_values($vals)];

        $db->table('products')->where('id', $parentId)->update([
            'has_variants'  => 1,
            'variant_types' => json_encode($variantTypes),
            'price'         => $prices ? min($prices) : (float) $rows[0]['price'],
            'mrp'           => $mrps ? max($mrps) : ($rows[0]['mrp'] ?? null),
            'stock'         => $stock,
            'updated_at'    => date('Y-m-d H:i:s'),
        ]);

        if ($childIds) $db->table('products')->whereIn('id', $childIds)->update(['deleted_at' => date('Y-m-d H:i:s')]);

        if ($db->transStatus() === false) { $db->transRollback(); CLI::error('  rollback: parent ' . $parentId); return; }
        $db->transCommit();
    }

    private function clip(string $s, int $n): string { return mb_strlen($s) > $n ? mb_substr($s, 0, $n - 1) . '…' : $s; }
    private function sample(array $vals): string
    {
        $u = array_values(array_unique(array_map(static fn ($v) => str_replace('\\', '', $v), $vals)));
        $s = implode('/', array_slice($u, 0, 6));
        return count($u) > 6 ? $s . '/…(' . count($u) . ')' : $s;
    }
}
