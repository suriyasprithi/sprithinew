<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Adds every column from the legacy u290807677_epey schema that isn't already
 * in the new design, and creates the few legacy tables (lucky_draw, qr_request,
 * subscription, support, otp, taluk_banner) that have no equivalent.
 *
 * Lets us preserve every old field when we run the data migration script later.
 * Everything new is nullable / has sensible defaults so existing rows are not
 * affected.
 */
class LegacyFieldsAndTables extends Migration
{
    public function up()
    {
        // -------------------------------------------------------------------
        // users — merges legacy customer + vendor + user (staff) + delivery_person
        // -------------------------------------------------------------------
        $this->forge->addColumn('users', [
            // Personal / KYC
            'dob'                => ['type' => 'DATETIME',   'null' => true,  'after' => 'pincode'],
            'image'              => ['type' => 'VARCHAR',    'constraint' => 400, 'null' => true],
            'aadhar'             => ['type' => 'VARCHAR',    'constraint' => 30,  'null' => true],
            'aadhar_image'       => ['type' => 'VARCHAR',    'constraint' => 500, 'null' => true],
            'pan'                => ['type' => 'VARCHAR',    'constraint' => 30,  'null' => true],
            'pan_image'          => ['type' => 'VARCHAR',    'constraint' => 400, 'null' => true],
            'bank_passbook'      => ['type' => 'VARCHAR',    'constraint' => 500, 'null' => true],

            // Driver-specific docs
            'license_image'      => ['type' => 'VARCHAR',    'constraint' => 400, 'null' => true],
            'rc_image'           => ['type' => 'VARCHAR',    'constraint' => 500, 'null' => true],

            // Bank
            'bank_name'          => ['type' => 'VARCHAR',    'constraint' => 100, 'null' => true],
            'account_number'     => ['type' => 'VARCHAR',    'constraint' => 50,  'null' => true],
            'ifsc_code'          => ['type' => 'VARCHAR',    'constraint' => 100, 'null' => true],

            // Payment apps
            'gpay'               => ['type' => 'VARCHAR',    'constraint' => 50,  'null' => true],
            'phonepe'            => ['type' => 'VARCHAR',    'constraint' => 50,  'null' => true],
            'paytm'              => ['type' => 'VARCHAR',    'constraint' => 50,  'null' => true],
            'upi'                => ['type' => 'VARCHAR',    'constraint' => 100, 'null' => true],
            'payment_link'       => ['type' => 'VARCHAR',    'constraint' => 550, 'null' => true],

            // Extra wallets (we already have wallet_balance, level_*, buyback_wallet, global_wallet)
            'monthly_wallet'     => ['type' => 'DECIMAL',    'constraint' => '12,2', 'default' => 0],
            'lucky_wallet'       => ['type' => 'DECIMAL',    'constraint' => '12,2', 'default' => 0],
            'gift'               => ['type' => 'DECIMAL',    'constraint' => '12,2', 'default' => 0],
            'qr_wallet'          => ['type' => 'DECIMAL',    'constraint' => '12,2', 'default' => 0],

            // Geo (we have taluk_id from driver migration; add state + district)
            'state_id'           => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'district_id'        => ['type' => 'INT', 'unsigned' => true, 'null' => true],

            // Billing address (we already have address_line + landmark + city + pincode)
            'bill_address'       => ['type' => 'VARCHAR',    'constraint' => 500, 'null' => true],
            'bill_landmark'      => ['type' => 'VARCHAR',    'constraint' => 500, 'null' => true],
        ]);

        // -------------------------------------------------------------------
        // vendor_profiles — extras from legacy `vendor` table
        // -------------------------------------------------------------------
        $this->forge->addColumn('vendor_profiles', [
            'banner_image'       => ['type' => 'VARCHAR',    'constraint' => 500, 'null' => true],
            'trade_mark'         => ['type' => 'VARCHAR',    'constraint' => 500, 'null' => true],
        ]);

        // -------------------------------------------------------------------
        // orders — extras from legacy `order` table
        // -------------------------------------------------------------------
        $this->forge->addColumn('orders', [
            'order_number'           => ['type' => 'VARCHAR', 'constraint' => 50,   'null' => true],
            'delivery_address'       => ['type' => 'VARCHAR', 'constraint' => 1000, 'null' => true],
            'bill_address'           => ['type' => 'VARCHAR', 'constraint' => 1000, 'null' => true],
            'delivery_landmark'      => ['type' => 'VARCHAR', 'constraint' => 1000, 'null' => true],
            'bill_landmark'          => ['type' => 'VARCHAR', 'constraint' => 1000, 'null' => true],
            'payment_method'         => ['type' => 'VARCHAR', 'constraint' => 20,   'null' => true], // online / cod
            'delivery_date'          => ['type' => 'VARCHAR', 'constraint' => 100,  'null' => true],
            'total_km'               => ['type' => 'INT',     'default' => 0],
            'delivery_minutes'       => ['type' => 'DECIMAL', 'constraint' => '8,2', 'default' => 0],
            'driver_id'              => ['type' => 'BIGINT',  'unsigned' => true, 'null' => true],
            'delivery_pincode'       => ['type' => 'VARCHAR', 'constraint' => 10,   'null' => true],
            'km_slab_id'             => ['type' => 'BIGINT',  'unsigned' => true, 'null' => true],
            'pay_to_vendor'          => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'pay_to_admin'           => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'pay_to_delivery_person' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
            'delivery_person_amount' => ['type' => 'DECIMAL', 'constraint' => '11,2', 'default' => 0],
        ]);

        // -------------------------------------------------------------------
        // order_items — extra from legacy `order_details` table
        // -------------------------------------------------------------------
        $this->forge->addColumn('order_items', [
            'commission_amount'  => ['type' => 'DECIMAL', 'constraint' => '11,2', 'default' => 0],
        ]);

        // -------------------------------------------------------------------
        // legacy_id_map — tracks old ID → new ID per table during migration
        // -------------------------------------------------------------------
        $this->forge->addField([
            'id'         => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'old_table'  => ['type' => 'VARCHAR', 'constraint' => 50],
            'old_id'     => ['type' => 'INT'],
            'new_table'  => ['type' => 'VARCHAR', 'constraint' => 50],
            'new_id'     => ['type' => 'BIGINT', 'unsigned' => true],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey(['old_table', 'old_id']);
        $this->forge->addKey(['new_table', 'new_id']);
        $this->forge->createTable('legacy_id_map');

        // -------------------------------------------------------------------
        // lucky_draw_entries — legacy lucky_draw
        // -------------------------------------------------------------------
        $this->forge->addField([
            'id'             => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'vendor_id'      => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'taluk_id'       => ['type' => 'INT', 'unsigned' => true, 'null' => true],
            'set_number'     => ['type' => 'INT', 'default' => 0],
            'refer_code'     => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'mobile_number'  => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
            'status'         => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'created_at'     => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('vendor_id');
        $this->forge->addKey('taluk_id');
        $this->forge->createTable('lucky_draw_entries');

        // -------------------------------------------------------------------
        // qr_requests — legacy qr_request (vendor QR payment requests)
        // -------------------------------------------------------------------
        $this->forge->addField([
            'id'              => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'vendor_id'       => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'customer_mobile' => ['type' => 'VARCHAR', 'constraint' => 15, 'null' => true],
            'amount'          => ['type' => 'DECIMAL', 'constraint' => '11,2', 'default' => 0],
            'status'          => ['type' => 'TINYINT', 'constraint' => 2, 'default' => 0], // 0=pending,1=approved,2=rejected
            'created_at'      => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('vendor_id');
        $this->forge->createTable('qr_requests');

        // -------------------------------------------------------------------
        // email_subscriptions — legacy subscription (newsletter)
        // -------------------------------------------------------------------
        $this->forge->addField([
            'id'         => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'email'      => ['type' => 'VARCHAR', 'constraint' => 200],
            'status'     => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('email');
        $this->forge->createTable('email_subscriptions');

        // -------------------------------------------------------------------
        // support_tickets — legacy support
        // -------------------------------------------------------------------
        $this->forge->addField([
            'id'            => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'       => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'ticket_number' => ['type' => 'VARCHAR', 'constraint' => 20, 'null' => true],
            'type'          => ['type' => 'INT', 'null' => true],
            'title'         => ['type' => 'VARCHAR', 'constraint' => 250, 'null' => true],
            'description'   => ['type' => 'TEXT', 'null' => true],
            'image'         => ['type' => 'VARCHAR', 'constraint' => 250, 'null' => true],
            'reply'         => ['type' => 'LONGTEXT', 'null' => true],
            'status'        => ['type' => 'TINYINT', 'constraint' => 2, 'default' => 0],
            'created_at'    => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('user_id');
        $this->forge->createTable('support_tickets');

        // -------------------------------------------------------------------
        // otp_codes — legacy otp (mobile verification codes)
        // -------------------------------------------------------------------
        $this->forge->addField([
            'id'            => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'user_id'       => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'mobile_number' => ['type' => 'VARCHAR', 'constraint' => 15],
            'otp'           => ['type' => 'VARCHAR', 'constraint' => 10],
            'expires_at'    => ['type' => 'DATETIME', 'null' => true],
            'used_at'       => ['type' => 'DATETIME', 'null' => true],
            'created_at'    => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('mobile_number');
        $this->forge->createTable('otp_codes');

        // -------------------------------------------------------------------
        // taluk_banners — legacy taluk_banner (per-taluk home banners)
        // -------------------------------------------------------------------
        $this->forge->addField([
            'id'         => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
            'taluk_id'   => ['type' => 'INT', 'unsigned' => true],
            'banner_id'  => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true],
            'text'       => ['type' => 'VARCHAR', 'constraint' => 100, 'null' => true],
            'image'      => ['type' => 'VARCHAR', 'constraint' => 500, 'null' => true],
            'link'       => ['type' => 'VARCHAR', 'constraint' => 1000, 'null' => true],
            'status'     => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 1],
            'created_at' => ['type' => 'DATETIME', 'null' => true],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addKey('taluk_id');
        $this->forge->createTable('taluk_banners');
    }

    public function down()
    {
        $this->forge->dropTable('taluk_banners', true);
        $this->forge->dropTable('otp_codes', true);
        $this->forge->dropTable('support_tickets', true);
        $this->forge->dropTable('email_subscriptions', true);
        $this->forge->dropTable('qr_requests', true);
        $this->forge->dropTable('lucky_draw_entries', true);
        $this->forge->dropTable('legacy_id_map', true);

        $this->forge->dropColumn('order_items', ['commission_amount']);

        $this->forge->dropColumn('orders', [
            'order_number','delivery_address','bill_address','delivery_landmark',
            'bill_landmark','payment_method','delivery_date','total_km','delivery_minutes',
            'driver_id','delivery_pincode','km_slab_id',
            'pay_to_vendor','pay_to_admin','pay_to_delivery_person','delivery_person_amount',
        ]);

        $this->forge->dropColumn('vendor_profiles', ['banner_image','trade_mark']);

        $this->forge->dropColumn('users', [
            'dob','image','aadhar','aadhar_image','pan','pan_image','bank_passbook',
            'license_image','rc_image',
            'bank_name','account_number','ifsc_code',
            'gpay','phonepe','paytm','upi','payment_link',
            'monthly_wallet','lucky_wallet','gift','qr_wallet',
            'state_id','district_id',
            'bill_address','bill_landmark',
        ]);
    }
}
