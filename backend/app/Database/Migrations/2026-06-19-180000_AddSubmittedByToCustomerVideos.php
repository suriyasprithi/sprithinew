<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddSubmittedByToCustomerVideos extends Migration
{
    public function up()
    {
        // Customer-submitted videos: who submitted it. NULL = admin-uploaded promo.
        // Combined with status (pending|active|inactive|rejected) this drives the
        // approval flow — only 'active' videos show on the home carousel.
        $this->forge->addColumn('customer_videos', [
            'submitted_by' => [
                'type'     => 'BIGINT',
                'unsigned' => true,
                'null'     => true,
            ],
        ]);
    }

    public function down()
    {
        $this->forge->dropColumn('customer_videos', 'submitted_by');
    }
}
