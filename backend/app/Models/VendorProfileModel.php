<?php

namespace App\Models;

use CodeIgniter\Model;

class VendorProfileModel extends Model
{
    protected $table            = 'vendor_profiles';
    protected $primaryKey       = 'user_id';
    protected $useAutoIncrement = false;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = ['user_id','vendor_category_id','commission_pct','shop_name','address','area','state_id','district_id','taluk_id','pincode','gst','image'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}