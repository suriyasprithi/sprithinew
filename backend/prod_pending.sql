-- ============================================================
-- SPRITHI — CONSOLIDATED PROD-PENDING SCHEMA  (run once on LIVE)
-- Idempotent (IF NOT EXISTS). STRUCTURE ONLY — no data touched.
-- phpMyAdmin > u290807677_sprithi_new > SQL tab > paste > Go.
-- MySQL8 (not MariaDB) => 'IF NOT EXISTS' errors; tell me to regenerate.
-- ============================================================

-- [1] users columns (reserve wallets [today], KYC/bank, balances)
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `buyback_reserve` decimal(12,2) DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `level_reserve` decimal(12,2) DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `bonus_balance` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `qr_wallet` decimal(12,2) DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `kyc_status` varchar(20) NOT NULL DEFAULT 'none';
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `kyc_note` varchar(255) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `account_holder` varchar(150) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `aadhar` varchar(30) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `aadhar_image` varchar(500) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `pan` varchar(30) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `pan_image` varchar(400) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `bank_passbook` varchar(500) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `bank_name` varchar(100) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `account_number` varchar(50) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `ifsc_code` varchar(100) DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `upi` varchar(100) DEFAULT NULL;

-- [2] other new columns on existing app tables
ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `parent_id` int(10) unsigned DEFAULT NULL AFTER `name`;
ALTER TABLE `distribute_tokens` ADD COLUMN IF NOT EXISTS `bonus` decimal(12,2) DEFAULT 0.00 AFTER `tokens`;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `commission_amount` decimal(11,2) DEFAULT 0.00 AFTER `subtotal`;
ALTER TABLE `order_returns` ADD COLUMN IF NOT EXISTS `images` text DEFAULT NULL AFTER `reason`;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `order_group` varchar(40) DEFAULT NULL AFTER `id`;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `bill_path` varchar(255) DEFAULT NULL AFTER `prescription_path`;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `paid_via` varchar(20) DEFAULT NULL AFTER `payment_method`;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `qr_visible_to_driver` tinyint(1) DEFAULT 1 AFTER `driver_id`;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `cancelled_by` varchar(20) DEFAULT NULL AFTER `cancel_reason`;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `sale_mode` varchar(20) DEFAULT NULL AFTER `delivery_at`;
ALTER TABLE `purchase_commissions` ADD COLUMN IF NOT EXISTS `buyback_cycle_id` bigint(20) unsigned DEFAULT NULL AFTER `level`;
ALTER TABLE `token_requests` ADD COLUMN IF NOT EXISTS `attachment` varchar(255) DEFAULT NULL AFTER `notes`;
ALTER TABLE `wallet_transactions` ADD COLUMN IF NOT EXISTS `wallet` varchar(20) DEFAULT NULL AFTER `type`;

-- [3] new app tables
-- new table: customer_delivery_addresses
CREATE TABLE IF NOT EXISTS `customer_delivery_addresses` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `customer_id` bigint(20) unsigned NOT NULL,
  `address_line` varchar(255) DEFAULT NULL,
  `landmark` varchar(100) DEFAULT NULL,
  `city` varchar(80) DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `is_default` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `customer_id` (`customer_id`),
  KEY `customer_id_is_default` (`customer_id`,`is_default`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- new table: customer_wishlist
CREATE TABLE IF NOT EXISTS `customer_wishlist` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `vendor_id` bigint(20) unsigned DEFAULT NULL,
  `product_id` bigint(20) unsigned DEFAULT NULL,
  `variant_id` bigint(20) unsigned DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- new table: email_subscriptions
CREATE TABLE IF NOT EXISTS `email_subscriptions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(200) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- new table: legacy_id_map
CREATE TABLE IF NOT EXISTS `legacy_id_map` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `old_table` varchar(50) NOT NULL,
  `old_id` int(11) NOT NULL,
  `new_table` varchar(50) NOT NULL,
  `new_id` bigint(20) unsigned NOT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `old_table_old_id` (`old_table`,`old_id`),
  KEY `new_table_new_id` (`new_table`,`new_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- new table: lucky_draw_entries
CREATE TABLE IF NOT EXISTS `lucky_draw_entries` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` bigint(20) unsigned DEFAULT NULL,
  `taluk_id` int(10) unsigned DEFAULT NULL,
  `set_number` int(11) NOT NULL DEFAULT 0,
  `refer_code` varchar(20) DEFAULT NULL,
  `mobile_number` varchar(15) DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `taluk_id` (`taluk_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- new table: otp_codes
CREATE TABLE IF NOT EXISTS `otp_codes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `mobile_number` varchar(15) NOT NULL,
  `otp` varchar(10) NOT NULL,
  `expires_at` datetime DEFAULT NULL,
  `used_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `mobile_number` (`mobile_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- new table: product_reviews
CREATE TABLE IF NOT EXISTS `product_reviews` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `product_id` bigint(20) unsigned DEFAULT NULL,
  `variant_id` bigint(20) unsigned DEFAULT NULL,
  `rating` int(11) NOT NULL DEFAULT 0,
  `review` longtext DEFAULT NULL,
  `image` longtext DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- new table: qr_requests
CREATE TABLE IF NOT EXISTS `qr_requests` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` bigint(20) unsigned DEFAULT NULL,
  `customer_mobile` varchar(15) DEFAULT NULL,
  `amount` decimal(11,2) NOT NULL DEFAULT 0.00,
  `status` tinyint(2) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- new table: support_tickets
CREATE TABLE IF NOT EXISTS `support_tickets` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `ticket_number` varchar(20) DEFAULT NULL,
  `type` int(11) DEFAULT NULL,
  `title` varchar(250) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `image` varchar(250) DEFAULT NULL,
  `reply` longtext DEFAULT NULL,
  `status` tinyint(2) NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- new table: taluk_banners
CREATE TABLE IF NOT EXISTS `taluk_banners` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `taluk_id` int(10) unsigned NOT NULL,
  `banner_id` bigint(20) unsigned DEFAULT NULL,
  `text` varchar(100) DEFAULT NULL,
  `image` varchar(500) DEFAULT NULL,
  `link` varchar(1000) DEFAULT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `taluk_id` (`taluk_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- new table: vendor_templates
CREATE TABLE IF NOT EXISTS `vendor_templates` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(150) NOT NULL,
  `vendor_category_id` int(10) unsigned DEFAULT NULL,
  `commission_pct` decimal(5,2) NOT NULL DEFAULT 10.00,
  `created_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- new table: withdrawals
CREATE TABLE IF NOT EXISTS `withdrawals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `method` varchar(20) NOT NULL,
  `details_json` text DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `processed_by` bigint(20) unsigned DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

