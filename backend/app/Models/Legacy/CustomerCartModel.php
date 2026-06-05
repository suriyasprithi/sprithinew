<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `customer_cart` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class CustomerCartModel extends Model
{
    protected $table         = 'customer_cart';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'cus_id',
        'product_v_id',
        'qty',
        'ven_id',
        'created_on',
        'status',
    ];
}