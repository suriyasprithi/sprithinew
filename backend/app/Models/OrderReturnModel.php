<?php

namespace App\Models;

use CodeIgniter\Model;

class OrderReturnModel extends Model
{
    protected $table         = 'order_returns';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = ['order_id', 'customer_id', 'reason', 'status'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}
