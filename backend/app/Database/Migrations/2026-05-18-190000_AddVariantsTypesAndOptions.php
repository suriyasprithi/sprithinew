<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddVariantsTypesAndOptions extends Migration
{
    public function up()
    {
        $productFields = $this->db->getFieldNames('products');
        if (! in_array('variant_types', $productFields, true)) {
            $this->forge->addColumn('products', [
                'variant_types' => [
                    'type'  => 'TEXT',
                    'null'  => true,
                    'after' => 'has_variants',
                ],
            ]);
        }

        $variantFields = $this->db->getFieldNames('product_variants');
        $cols = [];
        if (! in_array('sku', $variantFields, true)) {
            $cols['sku'] = ['type' => 'VARCHAR', 'constraint' => 64, 'null' => true, 'after' => 'name'];
        }
        if (! in_array('options', $variantFields, true)) {
            $cols['options'] = ['type' => 'TEXT', 'null' => true, 'after' => 'sku'];
        }
        if ($cols) {
            $this->forge->addColumn('product_variants', $cols);
        }
    }

    public function down()
    {
        $productFields = $this->db->getFieldNames('products');
        if (in_array('variant_types', $productFields, true)) {
            $this->forge->dropColumn('products', 'variant_types');
        }
        $variantFields = $this->db->getFieldNames('product_variants');
        foreach (['options', 'sku'] as $col) {
            if (in_array($col, $variantFields, true)) {
                $this->forge->dropColumn('product_variants', $col);
            }
        }
    }
}
