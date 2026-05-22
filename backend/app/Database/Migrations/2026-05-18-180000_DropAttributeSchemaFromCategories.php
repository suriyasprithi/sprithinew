<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class DropAttributeSchemaFromCategories extends Migration
{
    public function up()
    {
        $fields = $this->db->getFieldNames('categories');
        if (in_array('attribute_schema', $fields, true)) {
            $this->forge->dropColumn('categories', 'attribute_schema');
        }
    }

    public function down()
    {
        $this->forge->addColumn('categories', [
            'attribute_schema' => [
                'type'  => 'TEXT',
                'null'  => true,
                'after' => 'vendor_category_id',
            ],
        ]);
    }
}
