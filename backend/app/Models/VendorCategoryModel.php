<?php

namespace App\Models;

use CodeIgniter\Model;

class VendorCategoryModel extends Model
{
    protected $table            = 'vendor_categories';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = ['name', 'image', 'status', 'free_delivery_min', 'delivery_charge', 'gst_rate'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}
