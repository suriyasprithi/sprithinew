<?php

namespace App\Models;

use CodeIgniter\Model;

class CustomerVideoModel extends Model
{
    protected $table         = 'customer_videos';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = ['title', 'video_path', 'sort_order', 'status', 'submitted_by'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}
