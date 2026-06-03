<?php

namespace App\Models;

use CodeIgniter\Model;

class VendorTemplateModel extends Model
{
    protected $table            = 'vendor_templates';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = false;
    protected $protectFields    = true;

    protected $allowedFields = ['name', 'vendor_category_id', 'commission_pct', 'created_by'];

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}
