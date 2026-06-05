<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `customer_review` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class CustomerReviewModel extends Model
{
    protected $table         = 'customer_review';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'cus_id',
        'review',
        'star',
        'product_v_id',
        'image',
        'created_on',
        'status',
    ];
}