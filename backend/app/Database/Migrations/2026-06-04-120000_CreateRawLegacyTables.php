<?php

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

/**
 * Creates the raw legacy u290807677_epey tables 1:1 (structure only, no data)
 * alongside the new epey_v2 schema.
 *
 * Source: u290807677_epey_no_data.sql (phpMyAdmin export, MariaDB 11.8).
 *
 * Creates 35 legacy tables with their exact legacy names. Notes:
 *   1. Collation utf8mb4_uca1400_ai_ci -> utf8mb4_unicode_ci
 *      (uca1400 exists only on MariaDB 11+, local server is 10.4).
 *   2. Two legacy tables are intentionally skipped because v2 already owns
 *      those exact names (product_variants, customer_wishlist) and their data
 *      is covered by the v2 schema.
 *
 * Structure is otherwise identical to the dump: columns, types, PK,
 * AUTO_INCREMENT.
 */
class CreateRawLegacyTables extends Migration
{
    /** Common table options applied to every table (collation normalized). */
    private const OPTS = 'ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';

    public function up()
    {
        $tables = $this->definitions();
        foreach ($tables as $sql) {
            $this->db->query($sql);
        }
    }

    public function down()
    {
        // Drop in reverse-safe order; no FKs so order is irrelevant.
        $names = [
            'banner', 'category', 'change_password', 'company', 'customer',
            'customer_cart', 'customer_review',
            'delivery_person', 'district', 'driver_km', 'driver_time', 'income',
            'lucky_draw', 'notification', '`order`', 'order_details', 'otp',
            'pincode', 'product', 'purchase',
            'qr_request', 'shop_category', 'state', 'subscription', 'support',
            'taluk', 'taluk_banner', 'token_profit', 'token_request', 'user',
            'variant', 'vendor', 'vendor_product', 'vendor_request', 'withdraw',
        ];
        foreach ($names as $name) {
            $this->db->query("DROP TABLE IF EXISTS {$name}");
        }
    }

    /** @return string[] CREATE TABLE statements, one per legacy table. */
    private function definitions(): array
    {
        $o = self::OPTS;

        return [
            // banner
            "CREATE TABLE IF NOT EXISTS `banner` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `type` varchar(100) NOT NULL,
              `dimension` varchar(100) NOT NULL,
              `text` varchar(100) NOT NULL,
              `image` varchar(400) NOT NULL,
              `link` varchar(800) NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=5",

            // category
            "CREATE TABLE IF NOT EXISTS `category` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `com_id` int(11) NOT NULL,
              `name` varchar(40) NOT NULL,
              `category_image` varchar(500) NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=27",

            // change_password
            "CREATE TABLE IF NOT EXISTS `change_password` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `user_id` int(11) NOT NULL,
              `ven_id` int(11) NOT NULL,
              `cus_id` int(11) NOT NULL,
              `type` int(11) NOT NULL,
              `content` varchar(500) NOT NULL,
              `created_on` datetime NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=20",

            // company
            "CREATE TABLE IF NOT EXISTS `company` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `name` varchar(200) NOT NULL,
              `company_name` varchar(200) NOT NULL,
              `mobile_number` varchar(20) NOT NULL,
              `email` varchar(200) NOT NULL,
              `password` varchar(200) NOT NULL,
              `profile` varchar(300) NOT NULL,
              `role` int(1) NOT NULL,
              `gstin` varchar(30) NOT NULL,
              `pan` varchar(30) NOT NULL,
              `bank_name` varchar(50) NOT NULL,
              `branch_name` varchar(50) NOT NULL,
              `ifsc_code` varchar(30) NOT NULL,
              `acc_holder` varchar(30) NOT NULL,
              `acc_number` varchar(30) NOT NULL,
              `upi` varchar(30) NOT NULL,
              `logo` varchar(400) NOT NULL,
              `sign` varchar(400) NOT NULL,
              `days` int(11) NOT NULL,
              `created_on` datetime NOT NULL,
              `status` int(1) NOT NULL,
              `address` varchar(500) NOT NULL,
              `vendor_url` varchar(300) NOT NULL,
              `admin_url` varchar(500) NOT NULL,
              `help_number` varchar(20) NOT NULL,
              `top_text` varchar(100) NOT NULL,
              `bottom_text` varchar(500) NOT NULL,
              `order_prefix` varchar(10) NOT NULL,
              `order_suffix` int(11) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=2",

            // customer
            "CREATE TABLE IF NOT EXISTS `customer` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `name` varchar(100) NOT NULL,
              `mobile_number` varchar(20) NOT NULL,
              `email` varchar(50) NOT NULL,
              `dob` datetime NOT NULL,
              `password` varchar(50) NOT NULL,
              `address` varchar(500) NOT NULL,
              `near_by` varchar(500) NOT NULL,
              `bill_address` varchar(500) NOT NULL,
              `bill_near_by` varchar(500) NOT NULL,
              `image` varchar(100) NOT NULL,
              `reffered_by` int(11) NOT NULL,
              `bank_name` varchar(100) NOT NULL,
              `account_number` varchar(100) NOT NULL,
              `ifsc_code` varchar(100) NOT NULL,
              `gpay` varchar(100) NOT NULL,
              `phonepe` varchar(100) NOT NULL,
              `paytm` varchar(100) NOT NULL,
              `upi` varchar(100) NOT NULL,
              `payment_link` varchar(100) NOT NULL,
              `global_wallet` decimal(11,2) NOT NULL,
              `level_wallet` decimal(11,2) NOT NULL,
              `level_1` decimal(11,2) NOT NULL,
              `level_2` decimal(11,2) NOT NULL,
              `level_3` decimal(11,2) NOT NULL,
              `buyback_wallet` decimal(11,2) NOT NULL,
              `monthly_wallet` decimal(11,2) NOT NULL,
              `wallet` decimal(11,2) NOT NULL,
              `aadhar` varchar(30) NOT NULL,
              `aadhar_photo` varchar(400) NOT NULL,
              `pan` varchar(30) NOT NULL,
              `pan_photo` varchar(200) NOT NULL,
              `state_id` int(11) NOT NULL,
              `district_id` int(11) NOT NULL,
              `taluk` int(11) NOT NULL,
              `bank_passbook` varchar(500) NOT NULL,
              `created_on` datetime NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=9476",

            // customer_cart
            "CREATE TABLE IF NOT EXISTS `customer_cart` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `cus_id` int(11) NOT NULL,
              `product_v_id` int(11) NOT NULL,
              `qty` decimal(11,2) NOT NULL,
              `ven_id` int(11) NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=235",

            // customer_review
            "CREATE TABLE IF NOT EXISTS `customer_review` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `cus_id` int(11) NOT NULL,
              `review` longtext NOT NULL,
              `star` int(11) NOT NULL,
              `product_v_id` int(11) NOT NULL,
              `image` longtext NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=3",

            // delivery_person
            "CREATE TABLE IF NOT EXISTS `delivery_person` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `name` varchar(50) NOT NULL,
              `mobile_number` varchar(20) NOT NULL,
              `address` varchar(300) NOT NULL,
              `state_id` int(11) NOT NULL,
              `district_id` int(11) NOT NULL,
              `pincode` varchar(500) NOT NULL,
              `aadhar_image` varchar(500) NOT NULL,
              `license_image` varchar(400) NOT NULL,
              `rc_image` varchar(500) NOT NULL,
              `password` varchar(400) NOT NULL,
              `profile` varchar(300) NOT NULL,
              `email` varchar(200) NOT NULL,
              `edit` int(1) NOT NULL DEFAULT 0,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=6",

            // district
            "CREATE TABLE IF NOT EXISTS `district` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `name` varchar(100) NOT NULL,
              `state_id` int(11) NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=48",

            // driver_km
            "CREATE TABLE IF NOT EXISTS `driver_km` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `from` decimal(11,2) NOT NULL,
              `to` decimal(11,2) NOT NULL,
              `price` decimal(11,2) NOT NULL,
              `pincode` varchar(600) NOT NULL,
              `state_id` int(11) NOT NULL,
              `district_id` int(11) NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=7",

            // driver_time
            "CREATE TABLE IF NOT EXISTS `driver_time` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `from` varchar(100) NOT NULL,
              `price` decimal(11,2) NOT NULL,
              `pincode` varchar(600) NOT NULL,
              `state_id` int(11) NOT NULL,
              `district_id` int(11) NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=701",

            // income
            "CREATE TABLE IF NOT EXISTS `income` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `cus_id` int(11) NOT NULL,
              `ven_id` int(11) NOT NULL,
              `pur_id` int(11) NOT NULL,
              `type` int(11) NOT NULL,
              `amount` decimal(11,2) NOT NULL,
              `level` int(11) NOT NULL,
              `created_on` datetime NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=20730",

            // lucky_draw
            "CREATE TABLE IF NOT EXISTS `lucky_draw` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `ven_id` int(11) NOT NULL,
              `set` int(11) NOT NULL,
              `taluk_id` int(11) NOT NULL,
              `refer` varchar(20) NOT NULL,
              `mobile_number` varchar(20) NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=136",

            // notification
            "CREATE TABLE IF NOT EXISTS `notification` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `user_id` int(11) NOT NULL,
              `ven_id` int(11) NOT NULL,
              `cus_id` int(11) NOT NULL,
              `type` int(11) NOT NULL,
              `content` varchar(500) NOT NULL,
              `created_on` datetime NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=6903",

            // order (reserved word -> backticked)
            "CREATE TABLE IF NOT EXISTS `order` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `cus_id` int(11) NOT NULL,
              `ven_id` int(11) NOT NULL,
              `order_id` varchar(20) NOT NULL,
              `address` varchar(1000) NOT NULL,
              `bill_address` varchar(1000) NOT NULL,
              `near_by` varchar(1000) NOT NULL,
              `bill_near_by` varchar(1000) NOT NULL,
              `payment_method` int(11) NOT NULL COMMENT 'online,cod',
              `order_description` varchar(1000) NOT NULL,
              `delivery_person` int(11) NOT NULL,
              `order_status` int(11) NOT NULL COMMENT '0=new order,1=assign driver,2=driver pickup,3=delivered',
              `delivery_date` varchar(100) NOT NULL,
              `pay_to_vendor` int(11) NOT NULL,
              `pay_to_admin` int(11) NOT NULL,
              `pay_to_delivery_person` int(11) NOT NULL,
              `delivery_person_amount` decimal(11,2) NOT NULL,
              `total_km` int(11) NOT NULL,
              `km_id` int(11) NOT NULL,
              `pincode` int(11) NOT NULL,
              `delivery_time` decimal(11,2) NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=79",

            // order_details
            "CREATE TABLE IF NOT EXISTS `order_details` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `variant_id` int(11) NOT NULL,
              `variant_price` decimal(11,2) NOT NULL,
              `variant_qty` decimal(11,2) NOT NULL,
              `commission` decimal(11,2) NOT NULL,
              `order_id` int(11) NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=194",

            // otp
            "CREATE TABLE IF NOT EXISTS `otp` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `user_id` int(11) NOT NULL,
              `ven_id` int(11) NOT NULL,
              `cus_id` int(11) NOT NULL,
              `mobile_number` varchar(20) NOT NULL,
              `otp` int(10) NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=1470",

            // pincode (dump has PK but no AUTO_INCREMENT)
            "CREATE TABLE IF NOT EXISTS `pincode` (
              `id` int(11) NOT NULL,
              `code` varchar(100) NOT NULL,
              `name` varchar(100) NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o}",

            // product
            "CREATE TABLE IF NOT EXISTS `product` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `name` varchar(100) NOT NULL,
              `variant_id` varchar(100) NOT NULL,
              `image` varchar(400) NOT NULL,
              `accessories` varchar(500) NOT NULL COMMENT 'direct variant id',
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=41",

            // purchase
            "CREATE TABLE IF NOT EXISTS `purchase` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `ven_id` int(11) NOT NULL,
              `cus_id` int(11) NOT NULL,
              `mobile_number` varchar(20) NOT NULL,
              `purchase_id` varchar(50) NOT NULL,
              `amount` int(11) NOT NULL,
              `commission` decimal(11,2) NOT NULL,
              `created_on` datetime NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=2942",

            // qr_request
            "CREATE TABLE IF NOT EXISTS `qr_request` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `ven_id` int(11) NOT NULL,
              `mobile_number` varchar(20) NOT NULL,
              `amount` decimal(11,2) NOT NULL,
              `created_on` datetime NOT NULL,
              `status` int(11) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=120",

            // shop_category
            "CREATE TABLE IF NOT EXISTS `shop_category` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `category` varchar(50) NOT NULL,
              `image` varchar(500) NOT NULL,
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=38",

            // state
            "CREATE TABLE IF NOT EXISTS `state` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `name` varchar(150) NOT NULL,
              `assign_to` int(11) NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=10",

            // subscription
            "CREATE TABLE IF NOT EXISTS `subscription` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `email` varchar(200) NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=25",

            // support
            "CREATE TABLE IF NOT EXISTS `support` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `user_id` int(11) NOT NULL,
              `ven_id` int(11) NOT NULL,
              `cus_id` int(11) NOT NULL,
              `type` int(11) NOT NULL,
              `title` varchar(250) NOT NULL,
              `description` varchar(1000) NOT NULL,
              `image` varchar(250) NOT NULL,
              `reply` longtext NOT NULL,
              `support_id` varchar(20) NOT NULL,
              `created_on` datetime NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=99",

            // taluk
            "CREATE TABLE IF NOT EXISTS `taluk` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `name` varchar(150) NOT NULL,
              `state_id` int(11) NOT NULL,
              `district_id` int(11) NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=340",

            // taluk_banner
            "CREATE TABLE IF NOT EXISTS `taluk_banner` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `text` varchar(100) NOT NULL,
              `image` varchar(500) NOT NULL,
              `link` varchar(1000) NOT NULL,
              `taluk_id` int(11) NOT NULL,
              `banner_id` int(11) NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=8",

            // token_profit
            "CREATE TABLE IF NOT EXISTS `token_profit` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `state_percentage` decimal(11,2) NOT NULL,
              `district_percentage` decimal(11,2) NOT NULL,
              `taluk_percentage` decimal(11,2) NOT NULL,
              `vendor_percentage` double(11,2) NOT NULL,
              `direct_income` decimal(11,2) NOT NULL,
              `cus_reg_token` decimal(11,2) NOT NULL,
              `ref_reg_token` double(11,2) NOT NULL,
              `level_per` decimal(11,2) NOT NULL,
              `level_1` decimal(11,2) NOT NULL,
              `level_2` decimal(11,2) NOT NULL,
              `level_3` decimal(11,2) NOT NULL,
              `level_4` decimal(11,2) NOT NULL,
              `level_5` decimal(11,2) NOT NULL,
              `level_6` decimal(11,2) NOT NULL,
              `level_7` decimal(11,2) NOT NULL,
              `join_level_1` decimal(11,2) NOT NULL,
              `join_level_2` decimal(11,2) NOT NULL,
              `join_level_3` decimal(11,2) NOT NULL,
              `global_per` decimal(11,2) NOT NULL,
              `withdraw_limit` int(11) NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=2",

            // token_request
            "CREATE TABLE IF NOT EXISTS `token_request` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `user_id` int(11) NOT NULL,
              `type` int(11) NOT NULL,
              `request_token` int(11) NOT NULL,
              `profit` decimal(11,2) NOT NULL,
              `image` varchar(200) NOT NULL,
              `payment_type` varchar(100) NOT NULL,
              `created_on` datetime NOT NULL,
              `created_by` int(11) NOT NULL,
              `status` int(11) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=161",

            // user
            "CREATE TABLE IF NOT EXISTS `user` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `name` varchar(100) NOT NULL,
              `mobile_number` varchar(20) NOT NULL,
              `type` int(1) NOT NULL,
              `state_id` int(11) NOT NULL,
              `district_id` int(11) NOT NULL,
              `taluk_id` int(11) NOT NULL,
              `email` varchar(100) NOT NULL,
              `address` varchar(200) NOT NULL,
              `image` varchar(200) NOT NULL,
              `bank_name` varchar(100) NOT NULL,
              `account_number` varchar(50) NOT NULL,
              `ifsc_code` varchar(100) NOT NULL,
              `gpay` varchar(20) NOT NULL,
              `phonepe` varchar(20) NOT NULL,
              `paytm` varchar(20) NOT NULL,
              `upi` varchar(100) NOT NULL,
              `payment_link` varchar(550) NOT NULL,
              `request_person_id` int(11) NOT NULL,
              `gift` decimal(11,2) NOT NULL,
              `global_wallet` decimal(11,2) NOT NULL,
              `monthly_wallet` decimal(11,2) NOT NULL,
              `lucky_wallet` decimal(11,2) NOT NULL,
              `wallet` decimal(11,2) NOT NULL,
              `password` varchar(100) NOT NULL,
              `created_on` datetime NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=400",

            // variant
            "CREATE TABLE IF NOT EXISTS `variant` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `com_id` int(11) NOT NULL,
              `name` varchar(40) NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=30",

            // vendor
            "CREATE TABLE IF NOT EXISTS `vendor` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `shop_name` varchar(100) NOT NULL,
              `mobile_number` varchar(20) NOT NULL,
              `commission` decimal(11,2) NOT NULL,
              `category_id` int(11) NOT NULL,
              `email` varchar(150) NOT NULL,
              `address` varchar(500) NOT NULL,
              `password` varchar(100) NOT NULL,
              `image` varchar(500) NOT NULL,
              `banner_image` varchar(500) NOT NULL,
              `bank_name` varchar(100) NOT NULL,
              `account_number` varchar(50) NOT NULL,
              `ifsc_code` varchar(50) NOT NULL,
              `gpay` varchar(50) NOT NULL,
              `aadhar` varchar(40) NOT NULL,
              `pan` varchar(40) NOT NULL,
              `aadhar_photo` varchar(400) NOT NULL,
              `pan_photo` varchar(400) NOT NULL,
              `phonepe` varchar(50) NOT NULL,
              `paytm` varchar(50) NOT NULL,
              `upi` varchar(50) NOT NULL,
              `payment_link` varchar(200) NOT NULL,
              `monthly_wallet` decimal(11,2) NOT NULL,
              `wallet` decimal(11,2) NOT NULL,
              `qr_wallet` decimal(11,2) NOT NULL,
              `request_person_id` int(11) NOT NULL,
              `trade_mark` varchar(500) NOT NULL,
              `gst` varchar(500) NOT NULL,
              `pincode` varchar(800) NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=54",

            // vendor_product
            "CREATE TABLE IF NOT EXISTS `vendor_product` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `product` int(11) NOT NULL,
              `product_variant` varchar(500) NOT NULL,
              `product_accessories` varchar(500) NOT NULL,
              `vendor_id` int(11) NOT NULL,
              `created_on` datetime NOT NULL DEFAULT current_timestamp(),
              `status` int(1) NOT NULL DEFAULT 1,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=174",

            // vendor_request
            "CREATE TABLE IF NOT EXISTS `vendor_request` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `ven_id` int(11) NOT NULL,
              `taluk_id` int(11) NOT NULL,
              `request_token` int(100) NOT NULL,
              `profit` decimal(11,2) NOT NULL,
              `image` varchar(150) NOT NULL,
              `payment_type` varchar(150) NOT NULL,
              `created_on` datetime NOT NULL,
              `created_by` int(1) NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=104",

            // withdraw
            "CREATE TABLE IF NOT EXISTS `withdraw` (
              `id` int(11) NOT NULL AUTO_INCREMENT,
              `cus_id` int(11) NOT NULL,
              `ven_id` int(11) NOT NULL,
              `amount` int(11) NOT NULL,
              `transaction_id` varchar(30) NOT NULL,
              `created_on` datetime NOT NULL,
              `status` int(1) NOT NULL,
              PRIMARY KEY (`id`)
            ) {$o} AUTO_INCREMENT=72",
        ];
    }
}
