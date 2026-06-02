<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Support schema for the legacy data import (php spark legacy:import):
 *
 *  - users.legacy_password : holds the old MD5/plain password verbatim so the
 *    login flow can verify it once and transparently upgrade to bcrypt.
 *  - customer_wishlist     : minimal storage for legacy `customer_wishlist`.
 *  - product_reviews       : minimal storage for legacy `customer_review`.
 *
 * These are intentionally thin — just enough to preserve the legacy rows.
 */
class LegacyImportSupport extends Migration
{
    public function up()
    {
        // Old password kept as-is; cleared on first successful legacy login.
        $this->forge->addColumn('users', [
            'legacy_password' => ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'password_hash'],
        ]);

        // customer_wishlist — legacy `customer_wishlist`
        $this->forge->addField([
            'id'         => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'    => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'vendor_id'  => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'product_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'variant_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'status'     => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('user_id');
        $this->forge->createTable('customer_wishlist');

        // product_reviews — legacy `customer_review`
        $this->forge->addField([
            'id'         => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'    => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'product_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'variant_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'rating'     => ['type' => 'INT', 'default' => 0],
            'review'     => ['type' => 'LONGTEXT', 'null' => true],
            'image'      => ['type' => 'LONGTEXT', 'null' => true],
            'status'     => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('product_id');
        $this->forge->createTable('product_reviews');
    }

    public function down()
    {
        $this->forge->dropTable('product_reviews', true);
        $this->forge->dropTable('customer_wishlist', true);
        $this->forge->dropColumn('users', ['legacy_password']);
    }
}
