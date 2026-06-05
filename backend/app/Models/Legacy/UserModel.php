<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `user` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class UserModel extends Model
{
    protected $table         = 'user';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'name',
        'mobile_number',
        'type',
        'state_id',
        'district_id',
        'taluk_id',
        'email',
        'address',
        'image',
        'bank_name',
        'account_number',
        'ifsc_code',
        'gpay',
        'phonepe',
        'paytm',
        'upi',
        'payment_link',
        'request_person_id',
        'gift',
        'global_wallet',
        'monthly_wallet',
        'lucky_wallet',
        'wallet',
        'password',
        'created_on',
        'status',
    ];
}