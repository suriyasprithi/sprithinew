<?php

namespace App\Services;

use CodeIgniter\HTTP\Files\UploadedFile;

class UploadService
{
    /** @return array{ok:bool, path?:string, error?:string} */
    public function saveImage(?UploadedFile $file, string $subdir, int $maxBytes = 5 * 1024 * 1024): array
    {
        if (! $file || ! $file->isValid() || $file->hasMoved()) return ['ok' => false, 'error' => 'no_file'];
        if ($file->getSize() > $maxBytes) return ['ok' => false, 'error' => 'too_large'];
        if (! in_array($file->getMimeType(), ['image/jpeg', 'image/png', 'image/webp'], true)) return ['ok' => false, 'error' => 'invalid_type'];

        $dir = WRITEPATH . 'uploads/' . trim($subdir, '/');
        if (! is_dir($dir)) mkdir($dir, 0775, true);
        $name = $file->getRandomName();
        $file->move($dir, $name);
        return ['ok' => true, 'path' => 'uploads/' . trim($subdir, '/') . '/' . $name];
    }
}
