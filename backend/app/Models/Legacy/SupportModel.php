<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `support` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class SupportModel extends Model
{
    protected $table         = 'support';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'user_id',
        'ven_id',
        'cus_id',
        'type',
        'title',
        'description',
        'image',
        'reply',
        'support_id',
        'created_on',
        'status',
    ];
}