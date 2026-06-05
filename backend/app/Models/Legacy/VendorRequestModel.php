<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `vendor_request` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class VendorRequestModel extends Model
{
    protected $table         = 'vendor_request';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'ven_id',
        'taluk_id',
        'request_token',
        'profit',
        'image',
        'payment_type',
        'created_on',
        'created_by',
        'status',
    ];
}