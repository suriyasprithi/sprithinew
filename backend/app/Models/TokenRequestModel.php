<?php

namespace App\Models;

use CodeIgniter\Model;

class TokenRequestModel extends Model
{
    protected $table            = 'token_requests';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = ['requester_id','target_user_id','amount','tokens','status','current_level','processed_by','notes'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}