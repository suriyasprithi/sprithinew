<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Escalation flow:
 *   vendor request → current_level='taluk'
 *   taluk escalates → current_level='district'
 *   district escalates → current_level='state'
 *   state escalates → current_level='admin'
 *   any level approves → current_level='done', status='approved'
 *   admin rejects → current_level='rejected', status='rejected'
 */
class AddTokenRequestEscalation extends Migration
{
    public function up()
    {
        $this->forge->addColumn('token_requests', [
            'current_level' => [
                'type'       => 'VARCHAR',
                'constraint' => 20,
                'default'    => 'taluk',
                'after'      => 'status',
            ],
        ]);

        // Backfill any pre-existing rows so the new column has sensible values.
        $db = \Config\Database::connect();
        $db->query("UPDATE token_requests SET current_level = 'taluk'    WHERE status = 'pending'");
        $db->query("UPDATE token_requests SET current_level = 'done'     WHERE status = 'approved'");
        $db->query("UPDATE token_requests SET current_level = 'rejected' WHERE status = 'rejected'");
        $db->query("UPDATE token_requests SET current_level = 'rejected' WHERE status = 'cancelled'");
    }

    public function down()
    {
        $this->forge->dropColumn('token_requests', 'current_level');
    }
}
