<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `order_details` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class OrderDetailsModel extends Model
{
    protected $table         = 'order_details';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'variant_id',
        'variant_price',
        'variant_qty',
        'commission',
        'order_id',
        'created_on',
        'status',
    ];
}