<?php

namespace App\Libraries;

/**
 * Turns oversized / base64 / legacy-hosted images into small on-disk files.
 *
 * Two bloat sources existed on the public home page:
 *  1. Admin sent banner & category images as base64 `data:` URIs, stored verbatim
 *     in the DB and re-served inline (one hero/category was ~1.2 MB).
 *  2. ~37 category images pointed at the legacy server
 *     (sprithi.com/epey_admin/uploads/profile/*.jpg) at full resolution.
 * Together ~4–5.5 MB of images pushed mobile LCP to ~30 s.
 *
 * This helper decodes/fetches such an image, downscales it, re-encodes it, writes
 * it under public/uploads/<type>/ and returns its absolute URL so the value can be
 * cached, lazy-loaded and shared as a normal image. Non-data/URL values (already a
 * local uploads URL, or null) are returned unchanged. If GD is unavailable or
 * anything fails, the original value is returned so an image is never lost.
 */
class ImageOptimizer
{
    /** Longest edge, in px. Banners render at most ~520px tall / ~1100px wide. */
    public const MAX_DIM      = 1280;
    public const JPEG_QUALITY = 80;
    public const PNG_LEVEL    = 7;

    /** A base64 `data:` URI → resized local file URL (used on new admin uploads). */
    public static function fromDataUri(?string $value, string $type): ?string
    {
        if (! is_string($value) || strncmp($value, 'data:', 5) !== 0) {
            return $value; // already a URL / path / null
        }
        $comma = strpos($value, ',');
        if ($comma === false) return $value;
        if (stripos(substr($value, 5, $comma - 5), 'svg') !== false) return $value; // vector — leave

        $bin = base64_decode(substr($value, $comma + 1), true);
        if ($bin === false || $bin === '') return $value;

        return self::saveBinary($bin, $type) ?? $value;
    }

    /**
     * A remote http(s) image URL → resized local copy. Used by the migration to
     * pull legacy-hosted images local. Already-local uploads URLs are skipped so
     * the operation is idempotent.
     */
    public static function fromRemoteUrl(?string $value, string $type): ?string
    {
        if (! is_string($value) || ! preg_match('#^https?://#i', $value)) return $value;
        // Don't re-fetch images we already host under /uploads/.
        if (strpos($value, '/uploads/' . $type . '/') !== false) return $value;

        $bin = self::fetch($value);
        if ($bin === null || $bin === '') return $value;

        return self::saveBinary($bin, $type) ?? $value;
    }

    /** Decode raw bytes → downscale → re-encode → save → absolute URL (or null). */
    private static function saveBinary(string $bin, string $type): ?string
    {
        if (! function_exists('imagecreatefromstring')) return null; // GD missing
        $img = @imagecreatefromstring($bin);
        if ($img === false) return null;

        $w = imagesx($img);
        $h = imagesy($img);
        $max = max($w, $h);
        if ($max > self::MAX_DIM) {
            $scaled = imagescale($img, (int) round($w * self::MAX_DIM / $max));
            if ($scaled !== false) { $img = $scaled; }
        }

        $isPng = (strncmp($bin, "\x89PNG", 4) === 0);
        $dir   = FCPATH . 'uploads/' . $type . '/';
        if (! is_dir($dir)) @mkdir($dir, 0775, true);

        $name = bin2hex(random_bytes(8)) . ($isPng ? '.png' : '.jpg');
        $rel  = 'uploads/' . $type . '/' . $name;
        $full = $dir . $name;

        if ($isPng) {
            imagealphablending($img, false);
            imagesavealpha($img, true);
            $ok = imagepng($img, $full, self::PNG_LEVEL);
        } else {
            $ok = imagejpeg($img, $full, self::JPEG_QUALITY);
        }

        return ($ok && is_file($full)) ? base_url($rel) : null;
    }

    /** Best-effort download of a remote URL → bytes (cURL, then file_get_contents). */
    private static function fetch(string $url): ?string
    {
        if (function_exists('curl_init')) {
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_TIMEOUT        => 20,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_USERAGENT      => 'epey-image-optimizer',
            ]);
            $data = curl_exec($ch);
            $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($data !== false && $code >= 200 && $code < 300) return $data;
            return null;
        }
        $data = @file_get_contents($url);
        return $data === false ? null : $data;
    }
}
