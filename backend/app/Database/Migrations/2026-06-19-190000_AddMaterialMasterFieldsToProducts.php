<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Fields imported from the POS "Material Master" sheet (admin product import):
 *   mrp     — printed MRP; shown struck-through above price when mrp > price
 *   code    — product code / SKU from the source system
 *   barcode — barcode from the source system
 * All nullable — existing products and the normal create flow are unaffected.
 */
class AddMaterialMasterFieldsToProducts extends Migration
{
    public function up()
    {
        $cols = [];
        if (! $this->db->fieldExists('mrp', 'products')) {
            $cols['mrp'] = ['type' => 'DECIMAL', 'constraint' => '12,2', 'null' => true];
        }
        if (! $this->db->fieldExists('code', 'products')) {
            $cols['code'] = ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true];
        }
        if (! $this->db->fieldExists('barcode', 'products')) {
            $cols['barcode'] = ['type' => 'VARCHAR', 'constraint' => 50, 'null' => true];
        }
        if ($cols) {
            $this->forge->addColumn('products', $cols);
        }
    }

    public function down()
    {
        foreach (['mrp', 'code', 'barcode'] as $c) {
            if ($this->db->fieldExists($c, 'products')) {
                $this->forge->dropColumn('products', $c);
            }
        }
    }
}
