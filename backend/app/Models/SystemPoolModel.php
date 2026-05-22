<?php

namespace App\Models;

use CodeIgniter\Model;

class SystemPoolModel extends Model
{
    protected $table            = 'system_pools';
    protected $primaryKey       = 'pool_key';
    protected $useAutoIncrement = false;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = ['pool_key', 'balance'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = '';
    protected $updatedField  = 'updated_at';

    public function balanceOf(string $key): float
    {
        return (float) ($this->find($key)['balance'] ?? 0);
    }

    /** Atomically credit a pool. Creates the row if it doesn't exist. */
    public function add(string $key, float $amount): void
    {
        if ($amount <= 0) return;
        $existing = $this->find($key);
        if ($existing) {
            $this->update($key, ['balance' => (float) $existing['balance'] + $amount]);
        } else {
            $this->insert(['pool_key' => $key, 'balance' => $amount]);
        }
    }
}
