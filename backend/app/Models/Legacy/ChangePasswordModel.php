<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `change_password` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class ChangePasswordModel extends Model
{
    protected $table         = 'change_password';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'user_id',
        'ven_id',
        'cus_id',
        'type',
        'content',
        'created_on',
        'status',
    ];
}