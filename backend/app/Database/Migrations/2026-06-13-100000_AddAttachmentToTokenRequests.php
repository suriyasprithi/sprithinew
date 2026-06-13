<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Optional proof (image/PDF) the requester can attach to a token request —
 * stored as a path under public/uploads/token-requests/.
 */
class AddAttachmentToTokenRequests extends Migration
{
    public function up()
    {
        $this->forge->addColumn('token_requests', [
            'attachment' => [
                'type'       => 'VARCHAR',
                'constraint' => 255,
                'null'       => true,
                'after'      => 'notes',
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('token_requests', 'attachment');
    }
}
