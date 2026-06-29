<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;
use App\Libraries\ImageOptimizer;

/**
 * Backfill grid thumbnails for product images already on disk.
 *
 * The customer grid/cards load a small <name>_thumb.<ext> instead of the full
 * image (≈10x lighter over ~30k products + infinite scroll). New images get a
 * thumb at import / optimize time; this command backfills the existing ones.
 * Idempotent — skips images that already have a thumb unless --force.
 *
 *   php spark products:thumbs            # make any missing thumbs
 *   php spark products:thumbs --force    # regenerate all
 *   php spark products:thumbs --limit 500
 */
class MakeProductThumbs extends BaseCommand
{
    protected $group       = 'Maintenance';
    protected $name        = 'products:thumbs';
    protected $description = 'Generate grid thumbnails (<name>_thumb.<ext>) for product images under public/uploads/products.';
    protected $usage       = 'products:thumbs [--force] [--limit N]';
    protected $options     = [
        '--force' => 'Regenerate even when the thumbnail already exists',
        '--limit' => 'Process at most N images',
    ];

    public function run(array $params)
    {
        if (! function_exists('imagecreatefromstring')) {
            CLI::error('GD is not available — cannot generate thumbnails.');
            return;
        }
        $force = array_key_exists('force', $params) || CLI::getOption('force') !== null;
        $limit = (int) (CLI::getOption('limit') ?? 0);
        $dir   = FCPATH . 'uploads/products/';
        if (! is_dir($dir)) {
            CLI::error("Directory not found: {$dir}");
            return;
        }

        $exts = ['jpg', 'jpeg', 'png', 'webp'];
        $made = 0; $skipped = 0; $failed = 0; $seen = 0;

        foreach (scandir($dir) ?: [] as $f) {
            $full = $dir . $f;
            if (! is_file($full)) continue;
            $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
            if (! in_array($ext, $exts, true)) continue;
            if (stripos($f, '_thumb.') !== false) continue; // a thumbnail itself
            $seen++;

            if (! $force && is_file(ImageOptimizer::thumbSibling($full))) { $skipped++; continue; }
            if (ImageOptimizer::writeThumbFromFile($full, $force)) {
                $made++;
                if ($made % 200 === 0) CLI::write("  …{$made} thumbnails written");
            } else {
                $failed++;
            }
            if ($limit > 0 && $made >= $limit) break;
        }

        CLI::write(sprintf(
            'Thumbnails: %d made, %d already existed, %d failed (of %d source images).',
            $made, $skipped, $failed, $seen
        ), 'green');
    }
}
