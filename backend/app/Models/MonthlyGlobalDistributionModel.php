<?php

namespace App\Models;

use CodeIgniter\Model;

class MonthlyGlobalDistributionModel extends Model
{
    protected $table            = 'monthly_global_distributions';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = ['pool_id', 'user_id', 'amount'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = '';
}
