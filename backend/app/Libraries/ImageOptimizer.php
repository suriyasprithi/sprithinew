<?php

namespace App\Libraries;

/**
 * Turns oversized / base64 data-URI images into small on-disk files.
 *
 * The admin UI used to send banner & category images as base64 `data:` URIs,
 * which get stored verbatim in the DB and re-served inline on the public home
 * page — a single hero banner was ~1 MB, and ~4 MB of images on /home tanked the
 * mobile LCP (≈30 s on simulated slow 4G). This helper decodes such a URI,
 * downscales it to a sane dimension, re-encodes it, writes it under
 * public/uploads/<type>/ and returns its absolute URL so the value can be
 * cached, lazy-loaded and shared as a normal image instead of inline bytes.
 *
 * Non-data-URI values (already a URL/path) are returned unchanged. If GD is not
 * available, or anything fails, the original value is returned so an upload is
 * never lost — optimization is best-effort, not a gate.
 */
class ImageOptimizer
{
    /** Longest edge, in px. Banners render at most ~520px tall / ~1100px wide. */
    public const MAX_DIM      = 1280;
    public const JPEG_QUALITY = 80;
    public const PNG_LEVEL    = 7;

    /**
     * @param string|null $value  An image value from the request/DB (data: URI or URL).
     * @param string      $type   Sub-folder under public/uploads/ (e.g. 'banners').
     * @return string|null        Absolute URL of the saved file, or $value unchanged.
     */
    public static function fromDataUri(?string $value, string $type): ?string
    {
        if (! is_string($value) || strncmp($value, 'data:', 5) !== 0) {
            return $value; // already a URL / path / null — leave it
        }

        $comma = strpos($value, ',');
        if ($comma === false) return $value;
        $header = substr($value, 5, $comma - 5);          // e.g. "image/png;base64"

        // SVG is tiny and vector — GD can't read it; keep as-is.
        if (stripos($header, 'svg') !== false) return $value;
        if (! function_exists('imagecreatefromstring')) return $value; // GD missing

        $bin = base64_decode(substr($value, $comma + 1), true);
        if ($bin === false || $bin === '') return $value;

        $img = @imagecreatefromstring($bin);
        if ($img === false) return $value;

        $w = imagesx($img);
        $h = imagesy($img);
        $max = max($w, $h);
        if ($max > self::MAX_DIM) {
            $scaled = imagescale($img, (int) round($w * self::MAX_DIM / $max));
            if ($scaled !== false) {
                imagedestroy($img);
                $img = $scaled;
            }
        }

        $isPng = stripos($header, 'png') !== false;
        $dir   = FCPATH . 'uploads/' . $type . '/';
        if (! is_dir($dir)) @mkdir($dir, 0775, true);

        $name = bin2hex(random_bytes(8)) . ($isPng ? '.png' : '.jpg');
        $rel  = 'uploads/' . $type . '/' . $name;
        $full = $dir . $name;

        if ($isPng) {
            // Preserve transparency for logos/icon-style category art.
            imagealphablending($img, false);
            imagesavealpha($img, true);
            $ok = imagepng($img, $full, self::PNG_LEVEL);
        } else {
            $ok = imagejpeg($img, $full, self::JPEG_QUALITY);
        }
        imagedestroy($img);

        if (! $ok || ! is_file($full)) return $value;
        return base_url($rel);
    }
}
