<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `purchase` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class PurchaseModel extends Model
{
    protected $table         = 'purchase';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'ven_id',
        'cus_id',
        'mobile_number',
        'purchase_id',
        'amount',
        'commission',
        'created_on',
        'status',
    ];
}