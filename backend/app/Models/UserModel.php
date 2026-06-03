<?php

namespace App\Models;

use CodeIgniter\Model;

class UserModel extends Model
{
    protected $table            = 'users';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = true;
    protected $protectFields    = true;

    protected $allowedFields = [
        'name',
        'email',
        'mobile_number',
        'password_hash',
        'role',
        'status',
        'pincode',
        'referrer_id',
        'level_1_count',
        'level_2_count',
        'level_3_count',
        'wallet_balance',
        'level_wallet',
        'level_1_wallet',
        'level_2_wallet',
        'level_3_wallet',
        'buyback_wallet',
        'buyback_next_slot',
        'global_wallet',
        'token_balance',
        'vehicle_number',
        'license_number',
        'id_card_url',
        'monthly_salary',
        'km_rate',
        'hour_rate',
        'taluk_id',
        'assigned_vendor_id',
        'address_line',
        'landmark',
        'city',
        'password_reset_token',
        'password_reset_expires_at',
        'legacy_password',
        // Legacy import (2026-05-29 LegacyFieldsAndTables migration)
        'dob','image','aadhar','aadhar_image','pan','pan_image','bank_passbook',
        'license_image','rc_image',
        'bank_name','account_number','ifsc_code',
        'gpay','phonepe','paytm','upi','payment_link',
        'monthly_wallet','lucky_wallet','gift','qr_wallet',
        'state_id','district_id',
        'bill_address','bill_landmark',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
    protected $deletedField  = 'deleted_at';

    protected $validationRules = [
        'name'          => 'required|string|min_length[2]|max_length[100]',
        'mobile_number' => 'required|string|min_length[7]|max_length[15]',
        'role'          => 'required|in_list[customer,vendor,taluk,district,state,driver,admin]',
        'status'        => 'permit_empty|in_list[active,inactive,blocked]',
        'email'         => 'permit_empty|valid_email|max_length[150]',
        'password_hash' => 'required|string',
    ];

    public function findByMobileAndRole(string $mobile, string $role): ?array
    {
        return $this->where('mobile_number', $mobile)
            ->where('role', $role)
            ->where('status', 'active')
            ->first();
    }

    public function mobileExistsForRole(string $mobile, string $role): bool
    {
        return (bool) $this->where('mobile_number', $mobile)
            ->where('role', $role)
            ->first();
    }

    public function findActiveStaffByMobile(string $mobile): array
    {
        return $this->where('mobile_number', $mobile)
            ->where('role !=', 'customer')
            ->where('status', 'active')
            ->findAll();
    }
}
