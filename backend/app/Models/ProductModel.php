<?php

namespace App\Models;

use CodeIgniter\Model;

class ProductModel extends Model
{
    protected $table            = 'products';
    protected $primaryKey       = 'id';
    protected $useAutoIncrement = true;
    protected $returnType       = 'array';
    protected $useSoftDeletes   = true;
    protected $protectFields    = true;

    protected $allowedFields = [
        'vendor_id','category_id','sub_category_id','vendor_category_id','name','description','price','mrp','code','barcode',
        'stock','has_variants','variant_types','variant_images','image','attributes','status',
        // Material Master import (admin) — stored data, not shown to customers.
        'cost_price','profit_percent','profit','basic_price','discount_percent','discount',
        'wholesale_profit_percent','wholesale_profit','wholesale_price','incentive','incentive_percent',
        'cashback','cashback_percent','net_profit','tax_amount','wholesales_2','gst','gst_value',
        'supplier_price','agent_commission_perc','agent_commission','cess','cess_rate','covid',
        'covid_percent','cost_price_exceed','manual_rate','tax_type','agent','csquare','multi_pricing',
        'created_date','modified_date',
        // Comprehensive catalog import (admin) — stored data, not shown to customers.
        'tax_percentage','discount_type','discount_value','discount_amount','weight','length','width','height',
        'delivery_charge','min_stock_alert','max_order_qty','return_days','warranty_days','brand','hsn_code',
        'unit','short_description','tags','gallery_images','featured',
    ];

    protected $deletedField  = 'deleted_at';

    protected $useTimestamps = true;
    protected $dateFormat    = 'datetime';
    protected $createdField  = 'created_at';
    protected $updatedField  = 'updated_at';
}