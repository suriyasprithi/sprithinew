<?php

namespace App\Services;

use CodeIgniter\HTTP\Files\UploadedFile;

/**
 * Product-images ZIP for the catalog import. The ZIP is uploaded once, extracted
 * server-side to a per-batch temp dir, and the import then resolves each row's
 * image filename (case-insensitive) to an extracted file. Streams entries to disk
 * (never loads the whole ZIP in memory), is traversal-safe, and ignores anything
 * that isn't a supported image. Temp dirs are pruned after the import + by age.
 */
class ZipImportService
{
    /** Supported image extensions (lowercase). */
    public const SUPPORTED = ['jpg', 'jpeg', 'png', 'webp'];

    /** Extraction root under writable/ (never web-served). */
    private function root(): string { return WRITEPATH . 'import-images/'; }

    /**
     * Validate + extract a ZIP. Returns ['token','count']. Throws on a bad ZIP.
     * @throws \RuntimeException
     */
    public function extract(UploadedFile $zip, int $maxBytes): array
    {
        if (! $zip->isValid() || $zip->hasMoved()) throw new \RuntimeException('No ZIP uploaded');
        $ext = strtolower($zip->getClientExtension() ?: pathinfo($zip->getName(), PATHINFO_EXTENSION));
        if ($ext !== 'zip') throw new \RuntimeException('File must be a .zip');
        if ($zip->getSize() > $maxBytes) throw new \RuntimeException('ZIP exceeds the ' . round($maxBytes / 1048576) . ' MB limit');
        if (! class_exists('\ZipArchive')) throw new \RuntimeException('Server is missing the zip extension');

        $za = new \ZipArchive();
        if ($za->open($zip->getTempName()) !== true) throw new \RuntimeException('Corrupted or unreadable ZIP');

        $token = bin2hex(random_bytes(8));
        $dir   = $this->root() . $token . '/';
        if (! is_dir($dir)) @mkdir($dir, 0775, true);

        $manifest = [];   // lower(original basename) => stored (sanitized) filename
        for ($i = 0; $i < $za->numFiles; $i++) {
            $name = $za->getNameIndex($i);
            if ($name === false) continue;
            $name = str_replace('\\', '/', $name);
            if (substr($name, -1) === '/') continue;                 // directory entry
            $base = basename($name);                                 // strip dirs → traversal-safe
            if ($base === '' || $base[0] === '.') continue;          // hidden / dotfiles
            if (strpos($base, "\0") !== false) continue;             // null byte
            $fext = strtolower(pathinfo($base, PATHINFO_EXTENSION));
            if (! in_array($fext, self::SUPPORTED, true)) continue;  // ignore unsupported types

            $safe = $this->sanitize($base);
            $in   = $za->getStream($name);                           // stream — don't load all in memory
            if (! $in) continue;
            $out = @fopen($dir . $safe, 'wb');
            if ($out) {
                stream_copy_to_stream($in, $out);
                fclose($out);
                $manifest[strtolower($base)] = $safe;                // keyed by ORIGINAL name (matches the CSV)
            }
            fclose($in);
        }
        $za->close();
        file_put_contents($dir . '_manifest.json', json_encode($manifest));
        return ['token' => $token, 'count' => count($manifest)];
    }

    /** Absolute path of an extracted image by (CSV) filename, case-insensitive, or null. */
    public function resolve(string $token, string $filename): ?string
    {
        $token = $this->safeToken($token);
        if ($token === '') return null;
        $base = strtolower(basename(str_replace('\\', '/', trim($filename))));
        if ($base === '') return null;
        $stored = $this->manifest($token)[$base] ?? null;
        if (! $stored) return null;
        $path = $this->root() . $token . '/' . $stored;
        return is_file($path) ? $path : null;
    }

    public function count(string $token): int { return count($this->manifest($token)); }

    private function manifest(string $token): array
    {
        $token = $this->safeToken($token);
        $f = $this->root() . $token . '/_manifest.json';
        if (! is_file($f)) return [];
        $m = json_decode((string) file_get_contents($f), true);
        return is_array($m) ? $m : [];
    }

    public function cleanup(string $token): void
    {
        $token = $this->safeToken($token);
        if ($token !== '') $this->rrmdir($this->root() . $token . '/');
    }

    /** Housekeeping — remove batch dirs older than $hours (abandoned uploads). */
    public function prune(int $hours = 6): void
    {
        $root = $this->root();
        if (! is_dir($root)) return;
        foreach (glob($root . '*', GLOB_ONLYDIR) ?: [] as $d) {
            if (@filemtime($d) < time() - $hours * 3600) $this->rrmdir($d . '/');
        }
    }

    private function safeToken(string $t): string { return preg_replace('/[^a-f0-9]/', '', $t); }

    private function sanitize(string $name): string
    {
        $name = preg_replace('/[^A-Za-z0-9._-]+/', '_', $name);
        return substr($name, 0, 150) ?: 'img';
    }

    private function rrmdir(string $dir): void
    {
        if (! is_dir($dir)) return;
        foreach (scandir($dir) ?: [] as $f) {
            if ($f === '.' || $f === '..') continue;
            $p = $dir . $f;
            is_dir($p) ? $this->rrmdir($p . '/') : @unlink($p);
        }
        @rmdir($dir);
    }
}
