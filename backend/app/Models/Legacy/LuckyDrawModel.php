<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `lucky_draw` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class LuckyDrawModel extends Model
{
    protected $table         = 'lucky_draw';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'ven_id',
        'set',
        'taluk_id',
        'refer',
        'mobile_number',
        'created_on',
        'status',
    ];
}