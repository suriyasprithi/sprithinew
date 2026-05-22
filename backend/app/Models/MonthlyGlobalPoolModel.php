<?php

namespace App\Models;

use CodeIgniter\Model;

class MonthlyGlobalPoolModel extends Model
{
    protected $table            = 'monthly_global_pools';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = [
        'period', 'collected', 'distributed', 'eligible_count',
        'per_user_amount', 'distributed_at', 'notes',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    /**
     * Find or create the pool row for a given 'YYYY-MM' period. Returns the row
     * after ensuring it exists. Idempotent.
     */
    public function findOrCreate(string $period): array
    {
        $row = $this->where('period', $period)->first();
        if ($row) return $row;
        $id = $this->insert(['period' => $period], true);
        return $this->find($id);
    }

    /** Credit the monthly pool. Creates the row if missing. */
    public function add(string $period, float $amount): void
    {
        if ($amount <= 0) return;
        $row = $this->findOrCreate($period);
        $this->update($row['id'], ['collected' => (float) $row['collected'] + $amount]);
    }
}
