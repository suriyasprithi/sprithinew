<?php

namespace App\Models;

use CodeIgniter\Model;

class DeviceTokenModel extends Model
{
    protected $table            = 'device_tokens';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = [
        'user_id',
        'token',
        'platform',
    ];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';

    protected $validationRules = [
        'user_id'  => 'required|integer',
        'token'    => 'required|string|max_length[255]',
        'platform' => 'required|in_list[android,ios,web]',
    ];

    public function upsertToken(int $userId, string $token, string $platform): void
    {
        $existing = $this->where('token', $token)->first();
        if ($existing) {
            $this->update($existing['id'], [
                'user_id'  => $userId,
                'platform' => $platform,
            ]);
            return;
        }
        $this->insert([
            'user_id'  => $userId,
            'token'    => $token,
            'platform' => $platform,
        ]);
    }
}
