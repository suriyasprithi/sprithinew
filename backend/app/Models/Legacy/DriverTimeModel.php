<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `driver_time` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class DriverTimeModel extends Model
{
    protected $table         = 'driver_time';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'from',
        'price',
        'pincode',
        'state_id',
        'district_id',
        'created_on',
        'status',
    ];
}