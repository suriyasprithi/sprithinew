<?php

namespace App\Models;

use CodeIgniter\Model;

class OrderModel extends Model
{
    protected $table            = 'orders';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = ['customer_id','vendor_id','total','delivery_fee','delivery_minutes','delivery_at','payment_method','status','commission_distributed_at','notes','delivery_address','prescription_path','driver_id','delivered_at','cancel_reason','cancelled_by','cancelled_at','penalty','qr_transferred_at','sale_mode'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}