<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `income` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class IncomeModel extends Model
{
    protected $table         = 'income';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'cus_id',
        'ven_id',
        'pur_id',
        'type',
        'amount',
        'level',
        'created_on',
        'status',
    ];
}