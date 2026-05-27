<?php

namespace App\Models;

use CodeIgniter\Model;

class DeliveryTimeRateModel extends Model
{
    protected $table         = 'delivery_time_rates';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $protectFields = true;
    protected $allowedFields = ['taluk_id', 'time_min', 'price'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}
