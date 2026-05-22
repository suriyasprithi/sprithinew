<?php

namespace App\Models;

use CodeIgniter\Model;

class SystemSettingsModel extends Model
{
    protected $table            = 'system_settings';
    protected $primaryKey       = 'setting_key';
    protected $useAutoIncrement = false;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = ['setting_key', 'value'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = '';
    protected $updatedField  = 'updated_at';

    public function get(string $key, ?string $default = null): ?string
    {
        $row = $this->find($key);
        return $row['value'] ?? $default;
    }

    public function put(string $key, string $value): void
    {
        if ($this->find($key)) {
            $this->update($key, ['value' => $value]);
        } else {
            $this->insert(['setting_key' => $key, 'value' => $value]);
        }
    }
}
