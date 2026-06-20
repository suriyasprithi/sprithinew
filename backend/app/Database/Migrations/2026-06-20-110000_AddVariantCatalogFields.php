<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Per-variant catalog fields for the universal importer. mrp (strikethrough),
 * barcode (optional), weight. All nullable. Variant attributes themselves stay
 * in product_variants.options (JSON) — no per-attribute columns.
 */
class AddVariantCatalogFields extends Migration
{
    public function up()
    {
        $cols = [];
        if (! $this->db->fieldExists('mrp', 'product_variants')) {
            $cols['mrp'] = ['type' => 'DECIMAL', 'constraint' => '12,2', 'null' => true];
        }
        if (! $this->db->fieldExists('barcode', 'product_variants')) {
            $cols['barcode'] = ['type' => 'VARCHAR', 'constraint' => 64, 'null' => true];
        }
        if (! $this->db->fieldExists('weight', 'product_variants')) {
            $cols['weight'] = ['type' => 'DECIMAL', 'constraint' => '12,3', 'null' => true];
        }
        if ($cols) {
            $this->forge->addColumn('product_variants', $cols);
        }
    }

    public function down()
    {
        foreach (['mrp', 'barcode', 'weight'] as $c) {
            if ($this->db->fieldExists($c, 'product_variants')) {
                $this->forge->dropColumn('product_variants', $c);
            }
        }
    }
}
