<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Sub Category level: Vendor Category → Product Category → Sub Category.
 * Each sub-category belongs to one product category (categories.id); a product
 * category can have many. Kept as its own table (not categories.parent_id) so
 * the two levels stay cleanly separated. Uniqueness of a name is per parent
 * category, enforced in code (case-insensitive) via SubCategoryController.
 */
class CreateSubCategoriesTable extends Migration
{
    public function up()
    {
        if ($this->db->tableExists('sub_categories')) return;

        $this->forge->addField([
            'id'          => ['type' => 'INT', 'unsigned' => true, 'auto_increment' => true],
            'category_id' => ['type' => 'INT', 'unsigned' => true, 'null' => false],
            'name'        => ['type' => 'VARCHAR', 'constraint' => 100],
            'status'      => ['type' => 'ENUM', 'constraint' => ['active', 'inactive'], 'default' => 'active'],
            'created_at'  => ['type' => 'DATETIME', 'null' => true],
            'updated_at'  => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('category_id');                 // filter sub-cats by parent product category
        $this->forge->addKey(['category_id', 'name']);       // fast per-parent name lookup
        // FK → product category. Removing a product category removes its sub-cats.
        $this->forge->addForeignKey('category_id', 'categories', 'id', 'CASCADE', 'CASCADE', 'fk_subcat_category');
        $this->forge->createTable('sub_categories', true, ['ENGINE' => 'InnoDB']);
    }

    public function down()
    {
        $this->forge->dropTable('sub_categories', true);
    }
}
