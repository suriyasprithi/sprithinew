<?php

namespace App\Models;

use CodeIgniter\Model;

class DeliveryKmSlabModel extends Model
{
    protected $table         = 'delivery_km_slabs';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $protectFields = true;
    protected $allowedFields = ['taluk_id', 'from_km', 'to_km', 'price_per_km'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}
