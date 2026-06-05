<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `order` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class OrderModel extends Model
{
    protected $table         = 'order';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'cus_id',
        'ven_id',
        'order_id',
        'address',
        'bill_address',
        'near_by',
        'bill_near_by',
        'payment_method',
        'order_description',
        'delivery_person',
        'order_status',
        'delivery_date',
        'pay_to_vendor',
        'pay_to_admin',
        'pay_to_delivery_person',
        'delivery_person_amount',
        'total_km',
        'km_id',
        'pincode',
        'delivery_time',
        'created_on',
        'status',
    ];
}