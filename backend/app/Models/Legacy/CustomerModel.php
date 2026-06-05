<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `customer` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class CustomerModel extends Model
{
    protected $table         = 'customer';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'name',
        'mobile_number',
        'email',
        'dob',
        'password',
        'address',
        'near_by',
        'bill_address',
        'bill_near_by',
        'image',
        'reffered_by',
        'bank_name',
        'account_number',
        'ifsc_code',
        'gpay',
        'phonepe',
        'paytm',
        'upi',
        'payment_link',
        'global_wallet',
        'level_wallet',
        'level_1',
        'level_2',
        'level_3',
        'buyback_wallet',
        'monthly_wallet',
        'wallet',
        'aadhar',
        'aadhar_photo',
        'pan',
        'pan_photo',
        'state_id',
        'district_id',
        'taluk',
        'bank_passbook',
        'created_on',
        'status',
    ];
}