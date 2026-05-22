<?php

namespace App\Models;

use CodeIgniter\Model;

class DistributeTokenModel extends Model
{
    protected $table            = 'distribute_tokens';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = ['from_user_id','to_user_id','amount','tokens','notes'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = '';
}