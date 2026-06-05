<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `withdraw` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class WithdrawModel extends Model
{
    protected $table         = 'withdraw';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'cus_id',
        'ven_id',
        'amount',
        'transaction_id',
        'created_on',
        'status',
    ];
}