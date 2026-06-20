<?php

namespace App\Models;

use CodeIgniter\Model;

class BuybackCycleModel extends Model
{
    protected $table            = 'buyback_cycles';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = ['user_id', 'next_slot', 'status', 'opened_at', 'completed_at'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}
