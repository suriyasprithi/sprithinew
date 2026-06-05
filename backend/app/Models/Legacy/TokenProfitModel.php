<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `token_profit` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class TokenProfitModel extends Model
{
    protected $table         = 'token_profit';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'state_percentage',
        'district_percentage',
        'taluk_percentage',
        'vendor_percentage',
        'direct_income',
        'cus_reg_token',
        'ref_reg_token',
        'level_per',
        'level_1',
        'level_2',
        'level_3',
        'level_4',
        'level_5',
        'level_6',
        'level_7',
        'join_level_1',
        'join_level_2',
        'join_level_3',
        'global_per',
        'withdraw_limit',
        'status',
    ];
}