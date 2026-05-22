<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateHomeBannersTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id'            => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'slot'          => ['type' => 'VARCHAR', 'constraint' => 40],
            'sort_order'    => ['type' => 'INT', 'default' => 0],
            'eyebrow'       => ['type' => 'VARCHAR', 'constraint' => 120, 'null' => true],
            'title'         => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true],
            'highlight'     => ['type' => 'VARCHAR', 'constraint' => 200, 'null' => true],
            'subtitle'      => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'cta_label'     => ['type' => 'VARCHAR', 'constraint' => 60,  'null' => true],
            'cta_href'      => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true],
            'image_url'     => ['type' => 'TEXT', 'null' => true],
            'gradient_from' => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'gradient_mid'  => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'gradient_to'   => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'icon_name'     => ['type' => 'VARCHAR', 'constraint' => 40, 'null' => true],
            'status'        => ['type' => 'ENUM', 'constraint' => ['active', 'inactive'], 'default' => 'active'],
            'created_at'    => ['type' => 'DATETIME', 'null' => true],
            'updated_at'    => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addKey(['slot', 'status', 'sort_order']);
        $this->forge->createTable('home_banners');
    }

    public function down()
    {
        $this->forge->dropTable('home_banners', true);
    }
}
