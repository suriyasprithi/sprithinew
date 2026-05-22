<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddVariantImagesToProducts extends Migration
{
    public function up()
    {
        $fields = $this->db->getFieldNames('products');
        if (! in_array('variant_images', $fields, true)) {
            $this->forge->addColumn('products', [
                'variant_images' => [
                    'type'  => 'LONGTEXT',
                    'null'  => true,
                    'after' => 'variant_types',
                ],
            ]);
        }
    }

    public function down()
    {
        $fields = $this->db->getFieldNames('products');
        if (in_array('variant_images', $fields, true)) {
            $this->forge->dropColumn('products', 'variant_images');
        }
    }
}
