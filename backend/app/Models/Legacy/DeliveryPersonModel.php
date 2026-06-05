<?php

namespace App\Models\Legacy;

use CodeIgniter\Model;

/**
 * Raw legacy table `delivery_person` (from u290807677_epey, imported 1:1).
 * Read/write the original legacy rows; not part of the v2 schema.
 */
class DeliveryPersonModel extends Model
{
    protected $table         = 'delivery_person';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = [
        'name',
        'mobile_number',
        'address',
        'state_id',
        'district_id',
        'pincode',
        'aadhar_image',
        'license_image',
        'rc_image',
        'password',
        'profile',
        'email',
        'edit',
        'created_on',
        'status',
    ];
}