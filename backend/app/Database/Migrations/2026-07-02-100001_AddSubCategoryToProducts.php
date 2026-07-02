<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Link products to an optional Sub Category. Nullable so existing products (and
 * any product without a sub-category chosen) keep working unchanged — the field
 * is purely additive on top of category_id. FK sets NULL if the sub-category is
 * deleted, so a product is never orphaned.
 */
class AddSubCategoryToProducts extends Migration
{
    public function up()
    {
        if (! $this->db->fieldExists('sub_category_id', 'products')) {
            $this->forge->addColumn('products', [
                'sub_category_id' => ['type' => 'INT', 'unsigned' => true, 'null' => true, 'after' => 'category_id'],
            ]);
        }
        if (! $this->hasIndex('products', 'idx_products_sub_category')) {
            $this->db->query('ALTER TABLE `products` ADD INDEX `idx_products_sub_category` (`sub_category_id`)');
        }
        if (! $this->hasForeignKey('products', 'fk_products_sub_category')) {
            try {
                $this->db->query('ALTER TABLE `products` ADD CONSTRAINT `fk_products_sub_category` '
                    . 'FOREIGN KEY (`sub_category_id`) REFERENCES `sub_categories` (`id`) ON DELETE SET NULL ON UPDATE CASCADE');
            } catch (\Throwable $e) {
                // Non-fatal: a data/engine mismatch shouldn't block the column itself.
                log_message('warning', 'sub_category FK skipped: ' . $e->getMessage());
            }
        }
    }

    public function down()
    {
        if ($this->hasForeignKey('products', 'fk_products_sub_category')) {
            $this->db->query('ALTER TABLE `products` DROP FOREIGN KEY `fk_products_sub_category`');
        }
        if ($this->db->fieldExists('sub_category_id', 'products')) {
            $this->forge->dropColumn('products', 'sub_category_id');
        }
    }

    private function hasIndex(string $table, string $name): bool
    {
        foreach ($this->db->getIndexData($table) as $idx) {
            if (($idx->name ?? '') === $name) return true;
        }
        return false;
    }

    private function hasForeignKey(string $table, string $name): bool
    {
        foreach ($this->db->getForeignKeyData($table) as $fk) {
            if (($fk->constraint_name ?? '') === $name) return true;
        }
        return false;
    }
}
