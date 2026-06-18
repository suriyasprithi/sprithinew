<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddFreeDeliveryMinToCategories extends Migration
{
    public function up()
    {
        // Per-category "Free delivery above ₹X" threshold. 0 = free above ₹0
        // (always qualifies). Used by the rule-based delivery charge logic.
        $this->forge->addColumn('categories', [
            'free_delivery_min' => [
                'type'       => 'DECIMAL',
                'constraint' => '10,2',
                'default'    => 0.00,
                'null'       => false,
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('categories', 'free_delivery_min');
    }
}
