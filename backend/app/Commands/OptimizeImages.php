<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Libraries\ImageOptimizer;

/**
 * One-time cleanup: convert base64 `data:` images stored in the DB into small
 * on-disk files.
 *
 *   php spark images:optimize --dry-run     # report only, change nothing
 *   php spark images:optimize               # apply
 *   php spark images:optimize --limit 50    # process at most 50 rows per table
 *
 * Banner & category images were saved as base64 data URIs (a single hero banner
 * was ~1 MB) and re-served inline on the public /home page, which pushed mobile
 * LCP to ~30 s. Going forward the controllers downscale + file-ify on save (see
 * App\Libraries\ImageOptimizer); this command fixes the rows already in the DB.
 *
 * Idempotent — only rows whose value starts with `data:` are touched, so it is
 * safe to re-run. Requires the GD extension (extension=gd).
 */
class OptimizeImages extends BaseCommand
{
    protected $group       = 'Maintenance';
    protected $name        = 'images:optimize';
    protected $description  = 'Convert base64 data-URI images (banners/categories/products) to small files.';
    protected $usage       = 'images:optimize [--dry-run] [--limit N]';
    protected $options     = ['--dry-run' => 'Report only; do not write.', '--limit' => 'Max rows per table.'];

    /** [table, column, uploads sub-folder] */
    private const TARGETS = [
        ['home_banners',      'image_url', 'banners'],
        ['vendor_categories', 'image',     'categories'],
        ['products',          'image',     'products'],
    ];

    public function run(array $params)
    {
        if (! function_exists('imagecreatefromstring')) {
            CLI::error('GD not available — enable extension=gd before running.');
            return;
        }
        $dry   = CLI::getOption('dry-run') !== null;
        $limit = (int) (CLI::getOption('limit') ?? 0);

        $db = \Config\Database::connect();
        $count = 0; $beforeBytes = 0;

        foreach (self::TARGETS as [$table, $col, $type]) {
            if (! $db->tableExists($table)) { CLI::write("skip {$table} (no such table)", 'yellow'); continue; }

            $b = $db->table($table)->select("id, {$col}")->like($col, 'data:', 'after');
            if ($limit > 0) $b->limit($limit);
            $rows = $b->get()->getResultArray();
            CLI::write(sprintf('%s.%s — %d base64 row(s)', $table, $col, count($rows)), 'cyan');

            foreach ($rows as $r) {
                $old = (string) ($r[$col] ?? '');
                $new = ImageOptimizer::fromDataUri($old, $type);
                if (! is_string($new) || $new === $old || strncmp($new, 'data:', 5) === 0) {
                    CLI::write("  id={$r['id']} — could not convert (skipped)", 'yellow');
                    continue;
                }
                $count++; $beforeBytes += strlen($old);
                CLI::write(sprintf('  id=%-6s %dKB base64 → %s', $r['id'], intdiv(strlen($old), 1024), $new));
                if (! $dry) {
                    $db->table($table)->where('id', $r['id'])->update([$col => $new]);
                }
            }
        }

        CLI::newLine();
        CLI::write(sprintf('%s %d image(s); ~%dKB of inline base64 removed.',
            $dry ? '[DRY-RUN] would convert' : 'Converted', $count, intdiv($beforeBytes, 1024)),
            $count ? 'green' : 'white');
        if ($dry && $count) CLI::write('Re-run without --dry-run to apply.', 'yellow');
    }
}
