<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `company` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class CompanyModel extends Model
{
    protected $table         = 'company';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'name',
        'company_name',
        'mobile_number',
        'email',
        'password',
        'profile',
        'role',
        'gstin',
        'pan',
        'bank_name',
        'branch_name',
        'ifsc_code',
        'acc_holder',
        'acc_number',
        'upi',
        'logo',
        'sign',
        'days',
        'created_on',
        'status',
        'address',
        'vendor_url',
        'admin_url',
        'help_number',
        'top_text',
        'bottom_text',
        'order_prefix',
        'order_suffix',
    ];
}