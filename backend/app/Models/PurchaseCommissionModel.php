<?php

namespace App\Models;

use CodeIgniter\Model;

class PurchaseCommissionModel extends Model
{
    protected $table            = 'purchase_commissions';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = ['order_id','beneficiary_id','source_user_id','level','percent','amount'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = '';
}