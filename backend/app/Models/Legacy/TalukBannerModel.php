<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `taluk_banner` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class TalukBannerModel extends Model
{
    protected $table         = 'taluk_banner';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'text',
        'image',
        'link',
        'taluk_id',
        'banner_id',
        'created_on',
        'status',
    ];
}