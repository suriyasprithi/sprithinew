<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `vendor` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class VendorModel extends Model
{
    protected $table         = 'vendor';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'shop_name',
        'mobile_number',
        'commission',
        'category_id',
        'email',
        'address',
        'password',
        'image',
        'banner_image',
        'bank_name',
        'account_number',
        'ifsc_code',
        'gpay',
        'aadhar',
        'pan',
        'aadhar_photo',
        'pan_photo',
        'phonepe',
        'paytm',
        'upi',
        'payment_link',
        'monthly_wallet',
        'wallet',
        'qr_wallet',
        'request_person_id',
        'trade_mark',
        'gst',
        'pincode',
        'status',
    ];
}