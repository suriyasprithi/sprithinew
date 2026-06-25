<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Prescription orders are billed by the vendor as a single total plus an
 * optional photo/PDF of the pharmacy bill. bill_path stores that attachment so
 * the customer can view it alongside the prescription.
 */
class AddBillPathToOrders extends Migration
{
    public function up(): void
    {
        $fields = $this->db->getFieldNames('orders');
        if (! in_array('bill_path', $fields, true)) {
            $this->forge->addColumn('orders', [
                'bill_path' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'prescription_path'],
            ]);
        }
    }

    public function down(): void
    {
        $this->forge->dropColumn('orders', 'bill_path');
    }
}
