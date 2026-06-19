<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Store the remaining POS "Material Master" columns on products (admin import).
 * All nullable — only the admin import populates them; the normal create/bulk
 * flow leaves them NULL. (Code, Barcode, MRP, name, price, image, status,
 * category were already added earlier.) created_date/modified_date hold the
 * source sheet's dates verbatim, separate from the app's created_at/updated_at.
 */
class AddMaterialMasterAllFieldsToProducts extends Migration
{
    private const DECIMALS = [
        'cost_price', 'profit_percent', 'profit', 'basic_price', 'discount_percent', 'discount',
        'wholesale_profit_percent', 'wholesale_profit', 'wholesale_price', 'incentive', 'incentive_percent',
        'cashback', 'cashback_percent', 'net_profit', 'tax_amount', 'wholesales_2', 'gst', 'gst_value',
        'supplier_price', 'agent_commission_perc', 'agent_commission', 'cess', 'cess_rate', 'covid',
        'covid_percent', 'cost_price_exceed',
    ];
    private const STRINGS = [
        'manual_rate' => 10, 'tax_type' => 50, 'agent' => 100, 'csquare' => 50, 'multi_pricing' => 50,
    ];
    private const DATES = ['created_date', 'modified_date'];

    public function up()
    {
        $cols = [];
        foreach (self::DECIMALS as $c) {
            if (! $this->db->fieldExists($c, 'products')) {
                $cols[$c] = ['type' => 'DECIMAL', 'constraint' => '18,2', 'null' => true];
            }
        }
        foreach (self::STRINGS as $c => $len) {
            if (! $this->db->fieldExists($c, 'products')) {
                $cols[$c] = ['type' => 'VARCHAR', 'constraint' => $len, 'null' => true];
            }
        }
        foreach (self::DATES as $c) {
            if (! $this->db->fieldExists($c, 'products')) {
                $cols[$c] = ['type' => 'DATETIME', 'null' => true];
            }
        }
        if ($cols) {
            $this->forge->addColumn('products', $cols);
        }
    }

    public function down()
    {
        $all = array_merge(self::DECIMALS, array_keys(self::STRINGS), self::DATES);
        foreach ($all as $c) {
            if ($this->db->fieldExists($c, 'products')) {
                $this->forge->dropColumn('products', $c);
            }
        }
    }
}
