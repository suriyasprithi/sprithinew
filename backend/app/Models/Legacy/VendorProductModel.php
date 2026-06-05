<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `vendor_product` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class VendorProductModel extends Model
{
    protected $table         = 'vendor_product';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'product',
        'product_variant',
        'product_accessories',
        'vendor_id',
        'created_on',
        'status',
    ];
}