<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Comprehensive catalog-import columns on products. All nullable — only the
 * admin catalog import populates them; the normal vendor create/bulk flow and
 * the customer storefront leave/ignore them. (name, price, mrp, code, barcode,
 * image, status, category_id, cost_price, tax_type, tax_amount already exist.)
 */
class AddCatalogFieldsToProducts extends Migration
{
    private const DECIMALS = [
        'tax_percentage'  => '8,2',
        'discount_value'  => '12,2',
        'discount_amount' => '12,2',
        'weight'          => '12,3',
        'length'          => '12,2',
        'width'           => '12,2',
        'height'          => '12,2',
        'delivery_charge' => '12,2',
    ];
    private const INTS = ['min_stock_alert', 'max_order_qty', 'return_days', 'warranty_days'];
    private const STRINGS = [
        'brand'             => 120,
        'hsn_code'          => 20,
        'discount_type'     => 20,
        'unit'              => 20,
        'short_description' => 300,
        'tags'              => 500,
    ];

    public function up()
    {
        $cols = [];
        foreach (self::DECIMALS as $c => $cons) {
            if (! $this->db->fieldExists($c, 'products')) {
                $cols[$c] = ['type' => 'DECIMAL', 'constraint' => $cons, 'null' => true];
            }
        }
        foreach (self::INTS as $c) {
            if (! $this->db->fieldExists($c, 'products')) {
                $cols[$c] = ['type' => 'INT', 'null' => true];
            }
        }
        foreach (self::STRINGS as $c => $len) {
            if (! $this->db->fieldExists($c, 'products')) {
                $cols[$c] = ['type' => 'VARCHAR', 'constraint' => $len, 'null' => true];
            }
        }
        if (! $this->db->fieldExists('gallery_images', 'products')) {
            $cols['gallery_images'] = ['type' => 'TEXT', 'null' => true]; // JSON array of URLs
        }
        if (! $this->db->fieldExists('featured', 'products')) {
            $cols['featured'] = ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0, 'null' => true];
        }
        if ($cols) {
            $this->forge->addColumn('products', $cols);
        }
    }

    public function down()
    {
        $all = array_merge(
            array_keys(self::DECIMALS),
            self::INTS,
            array_keys(self::STRINGS),
            ['gallery_images', 'featured'],
        );
        foreach ($all as $c) {
            if ($this->db->fieldExists($c, 'products')) {
                $this->forge->dropColumn('products', $c);
            }
        }
    }
}
