<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Self-referential parent_id on categories so the catalog import can auto-create
 * sub-categories under a parent category. The original global UNIQUE(name) is
 * relaxed to a plain index so two different parents can each own a sub-category
 * of the same name — uniqueness is then enforced in code per (parent_id, name).
 */
class AddParentIdToCategories extends Migration
{
    public function up()
    {
        if (! $this->db->fieldExists('parent_id', 'categories')) {
            $this->forge->addColumn('categories', [
                'parent_id' => ['type' => 'INT', 'unsigned' => true, 'null' => true, 'after' => 'name'],
            ]);
        }

        // Drop the single-column UNIQUE index on `name` (CI default name: "name").
        foreach ($this->db->getIndexData('categories') as $idx) {
            $fields    = $idx->fields ?? [];
            $isUnique  = strtoupper((string) ($idx->type ?? '')) === 'UNIQUE';
            $onNameCol = is_array($fields) && $fields === ['name'];
            if (($idx->name ?? '') !== 'PRIMARY' && $onNameCol && ($isUnique || ($idx->name ?? '') === 'name')) {
                $this->db->query('ALTER TABLE `categories` DROP INDEX `' . $idx->name . '`');
                break;
            }
        }

        if (! $this->hasIndex('categories', 'idx_categories_name')) {
            $this->db->query('ALTER TABLE `categories` ADD INDEX `idx_categories_name` (`name`)');
        }
        if (! $this->hasIndex('categories', 'idx_categories_parent')) {
            $this->db->query('ALTER TABLE `categories` ADD INDEX `idx_categories_parent` (`parent_id`)');
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('parent_id', 'categories')) {
            $this->forge->dropColumn('categories', 'parent_id');
        }
    }

    private function hasIndex(string $table, string $name): bool
    {
        foreach ($this->db->getIndexData($table) as $idx) {
            if (($idx->name ?? '') === $name) {
                return true;
            }
        }
        return false;
    }
}
