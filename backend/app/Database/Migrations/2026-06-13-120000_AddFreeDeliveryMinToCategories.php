<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddFreeDeliveryMinToCategories extends Migration
{
    // Per-category free-delivery threshold for the Category free-delivery rule.
    // NULL / 0 = this category does not grant free delivery on its own.
    public function up()
    {
        if (! $this->db->fieldExists('free_delivery_min', 'categories')) {
            $this->forge->addColumn('categories', [
                'free_delivery_min' => [
                    'type'       => 'DECIMAL',
                    'constraint' => '12,2',
                    'null'       => true,
                    'after'      => 'token_cost',
                ],
            ]);
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('free_delivery_min', 'categories')) {
            $this->forge->dropColumn('categories', 'free_delivery_min');
        }
    }
}
