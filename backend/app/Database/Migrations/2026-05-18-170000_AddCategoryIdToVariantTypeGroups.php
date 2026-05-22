<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddCategoryIdToVariantTypeGroups extends Migration
{
    public function up()
    {
        $this->forge->addColumn('variant_type_groups', [
            'category_id' => [
                'type'     => 'INT',
                'unsigned' => true,
                'null'     => true,
                'after'    => 'name',
            ],
        ]);
        $this->db->query('ALTER TABLE variant_type_groups ADD INDEX idx_category_id (category_id)');
    }

    public function down()
    {
        $this->db->query('ALTER TABLE variant_type_groups DROP INDEX idx_category_id');
        $this->forge->dropColumn('variant_type_groups', 'category_id');
    }
}
