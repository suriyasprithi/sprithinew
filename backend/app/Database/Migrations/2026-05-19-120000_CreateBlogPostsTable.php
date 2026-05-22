<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateBlogPostsTable extends Migration
{
    public function up(): void
    {
        $this->forge->addField([
            'id'           => ['type' => 'BIGINT',   'unsigned' => true, 'auto_increment' => true],
            'slug'         => ['type' => 'VARCHAR',  'constraint' => 160, 'null' => false],
            'title'        => ['type' => 'VARCHAR',  'constraint' => 200, 'null' => false],
            'excerpt'      => ['type' => 'VARCHAR',  'constraint' => 500, 'null' => true],
            'cover_image'  => ['type' => 'LONGTEXT', 'null' => true],   // dataURL or URL
            'content'      => ['type' => 'LONGTEXT', 'null' => true],   // markdown source
            'status'       => ['type' => "ENUM('draft','published')", 'default' => 'draft'],
            'published_at' => ['type' => 'DATETIME', 'null' => true],
            'created_at'   => ['type' => 'DATETIME', 'null' => true],
            'updated_at'   => ['type' => 'DATETIME', 'null' => true],
            'deleted_at'   => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addPrimaryKey('id');
        $this->forge->addUniqueKey('slug');
        $this->forge->addKey('status');
        $this->forge->addKey('published_at');
        $this->forge->createTable('blog_posts');
    }

    public function down(): void
    {
        $this->forge->dropTable('blog_posts', true);
    }
}
