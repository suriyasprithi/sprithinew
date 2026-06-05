<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `qr_request` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class QrRequestModel extends Model
{
    protected $table         = 'qr_request';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'ven_id',
        'mobile_number',
        'amount',
        'created_on',
        'status',
    ];
}