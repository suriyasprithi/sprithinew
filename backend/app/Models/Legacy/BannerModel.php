<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `banner` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class BannerModel extends Model
{
    protected $table         = 'banner';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'type',
        'dimension',
        'text',
        'image',
        'link',
        'created_on',
        'status',
    ];
}