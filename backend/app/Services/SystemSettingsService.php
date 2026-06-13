<?php

namespace App\Services;

use App\Models\SystemSettingsModel;

class SystemSettingsService
{
    private static array $cache = [];

    public function get(string $key, ?string $default = null): ?string
    {
        if (array_key_exists($key, self::$cache)) return self::$cache[$key];
        $row = (new SystemSettingsModel())->find($key);
        return self::$cache[$key] = ($row['value'] ?? $default);
    }

    public function getFloat(string $key, float $default = 0): float
    {
        $v = $this->get($key);
        return $v === null ? $default : (float) $v;
    }

    public function set(string $key, string $value): void
    {
        $model = new SystemSettingsModel();
        $existing = $model->find($key);
        if ($existing) $model->update($key, ['value' => $value]);
        else           $model->insert(['setting_key' => $key, 'value' => $value]);
        self::$cache[$key] = $value;
    }

    public function all(): array
    {
        $rows = (new SystemSettingsModel())->findAll();
        $out = [];
        foreach ($rows as $r) $out[$r['setting_key']] = $r['value'];
        return $out;
    }
}
