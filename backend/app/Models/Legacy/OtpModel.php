<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `otp` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class OtpModel extends Model
{
    protected $table         = 'otp';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'user_id',
        'ven_id',
        'cus_id',
        'mobile_number',
        'otp',
        'status',
    ];
}