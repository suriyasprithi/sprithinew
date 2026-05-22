<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class MoveAttributeSchemaToCategories extends Migration
{
    public function up()
    {
        $this->forge->addColumn('categories', [
            'attribute_schema' => [
                'type'  => 'TEXT',
                'null'  => true,
                'after' => 'vendor_category_id',
            ],
        ]);

        $fields = $this->db->getFieldNames('vendor_categories');
        if (in_array('attribute_schema', $fields, true)) {
            $this->forge->dropColumn('vendor_categories', 'attribute_schema');
        }
    }

    public function down()
    {
        $this->forge->addColumn('vendor_categories', [
            'attribute_schema' => [
                'type'  => 'TEXT',
                'null'  => true,
                'after' => 'image',
            ],
        ]);
        $this->forge->dropColumn('categories', 'attribute_schema');
    }
}
