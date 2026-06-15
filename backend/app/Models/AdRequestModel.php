<?php

namespace App\Models;

use CodeIgniter\Model;

class AdRequestModel extends Model
{
    protected $table         = 'ad_requests';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = ['vendor_id', 'type', 'attachment', 'notes', 'status', 'processed_by'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}
