<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPasswordResetTokenToUsers extends Migration
{
    public function up()
    {
        $this->forge->addColumn('users', [
            'password_reset_token' => [
                'type'       => 'VARCHAR',
                'constraint' => 64,
                'null'       => true,
                'after'      => 'password_hash',
            ],
            'password_reset_expires_at' => [
                'type'  => 'DATETIME',
                'null'  => true,
                'after' => 'password_reset_token',
            ],
        ]);
        // Lookup by token must be fast and unique.
        $this->forge->addKey('password_reset_token');
        $this->db->query('ALTER TABLE users ADD INDEX idx_pw_reset_token (password_reset_token)');
    }

    public function down()
    {
        $this->db->query('ALTER TABLE users DROP INDEX idx_pw_reset_token');
        $this->forge->dropColumn('users', ['password_reset_token', 'password_reset_expires_at']);
    }
}
