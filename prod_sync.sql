-- ============================================================
-- SPRITHI prod schema top-up (idempotent: IF NOT EXISTS).
-- Safe to run repeatedly. Adds only; never drops/overwrites.
-- ============================================================

-- ---- New feature tables ----
CREATE TABLE IF NOT EXISTS `ad_requests` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` bigint(20) unsigned NOT NULL,
  `type` varchar(10) NOT NULL,
  `attachment` varchar(255) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `processed_by` bigint(20) unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `status` (`status`),
  KEY `type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `customer_videos` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `title` varchar(200) DEFAULT NULL,
  `video_path` varchar(255) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `status` varchar(20) NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `submitted_by` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `order_returns` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `customer_id` (`customer_id`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `driver_shifts` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) NOT NULL,
  `start_time` time DEFAULT NULL,
  `end_time` time DEFAULT NULL,
  `is_active` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `buyback_cycles` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `next_slot` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `status` varchar(20) NOT NULL DEFAULT 'open',
  `opened_at` datetime DEFAULT NULL,
  `completed_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `status_opened_at` (`status`,`opened_at`),
  KEY `user_id_status` (`user_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---- Column top-ups on existing tables ----
ALTER TABLE `products`
  ADD COLUMN IF NOT EXISTS `mrp` decimal(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `code` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `barcode` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `cost_price` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `profit_percent` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `profit` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `basic_price` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `discount_percent` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `discount` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `wholesale_profit_percent` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `wholesale_profit` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `wholesale_price` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `incentive` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `incentive_percent` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `cashback` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `cashback_percent` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `net_profit` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `tax_amount` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `wholesales_2` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `gst` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `gst_value` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `supplier_price` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `agent_commission_perc` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `agent_commission` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `cess` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `cess_rate` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `covid` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `covid_percent` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `cost_price_exceed` decimal(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `manual_rate` varchar(10) NULL,
  ADD COLUMN IF NOT EXISTS `tax_type` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `agent` varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS `csquare` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `multi_pricing` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `created_date` datetime NULL,
  ADD COLUMN IF NOT EXISTS `modified_date` datetime NULL,
  ADD COLUMN IF NOT EXISTS `tax_percentage` decimal(8,2) NULL,
  ADD COLUMN IF NOT EXISTS `discount_value` decimal(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `discount_amount` decimal(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `weight` decimal(12,3) NULL,
  ADD COLUMN IF NOT EXISTS `length` decimal(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `width` decimal(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `height` decimal(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `delivery_charge` decimal(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `min_stock_alert` int(11) NULL,
  ADD COLUMN IF NOT EXISTS `max_order_qty` int(11) NULL,
  ADD COLUMN IF NOT EXISTS `return_days` int(11) NULL,
  ADD COLUMN IF NOT EXISTS `warranty_days` int(11) NULL,
  ADD COLUMN IF NOT EXISTS `brand` varchar(120) NULL,
  ADD COLUMN IF NOT EXISTS `hsn_code` varchar(20) NULL,
  ADD COLUMN IF NOT EXISTS `discount_type` varchar(20) NULL,
  ADD COLUMN IF NOT EXISTS `unit` varchar(20) NULL,
  ADD COLUMN IF NOT EXISTS `short_description` varchar(300) NULL,
  ADD COLUMN IF NOT EXISTS `tags` varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS `gallery_images` text NULL,
  ADD COLUMN IF NOT EXISTS `featured` tinyint(1) NULL DEFAULT 0;

ALTER TABLE `product_variants`
  ADD COLUMN IF NOT EXISTS `mrp` decimal(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `barcode` varchar(64) NULL,
  ADD COLUMN IF NOT EXISTS `weight` decimal(12,3) NULL;

ALTER TABLE `vendor_profiles`
  ADD COLUMN IF NOT EXISTS `banner_image` varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS `trade_mark` varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS `image_pending` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `image_status` varchar(20) NULL,
  ADD COLUMN IF NOT EXISTS `image_reject_reason` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `image_reviewed_by` bigint(20) unsigned NULL;

ALTER TABLE `orders`
  ADD COLUMN IF NOT EXISTS `delivery_fee` decimal(10,2) NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `commission_distributed_at` datetime NULL,
  ADD COLUMN IF NOT EXISTS `order_number` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `delivery_address` varchar(1000) NULL,
  ADD COLUMN IF NOT EXISTS `prescription_path` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `bill_address` varchar(1000) NULL,
  ADD COLUMN IF NOT EXISTS `delivery_landmark` varchar(1000) NULL,
  ADD COLUMN IF NOT EXISTS `bill_landmark` varchar(1000) NULL,
  ADD COLUMN IF NOT EXISTS `payment_method` varchar(20) NULL,
  ADD COLUMN IF NOT EXISTS `delivery_date` varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS `total_km` int(11) NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `delivery_minutes` decimal(8,2) NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `driver_id` bigint(20) unsigned NULL,
  ADD COLUMN IF NOT EXISTS `delivery_pincode` varchar(10) NULL,
  ADD COLUMN IF NOT EXISTS `km_slab_id` bigint(20) unsigned NULL,
  ADD COLUMN IF NOT EXISTS `pay_to_vendor` tinyint(1) NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `pay_to_admin` tinyint(1) NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `pay_to_delivery_person` tinyint(1) NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `delivery_person_amount` decimal(11,2) NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `delivered_at` datetime NULL,
  ADD COLUMN IF NOT EXISTS `cancel_reason` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `cancelled_at` datetime NULL,
  ADD COLUMN IF NOT EXISTS `penalty` decimal(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `qr_transferred_at` datetime NULL,
  ADD COLUMN IF NOT EXISTS `delivery_at` datetime NULL;

ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `legacy_password` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `dob` datetime NULL,
  ADD COLUMN IF NOT EXISTS `shift` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `bonus_balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `image` varchar(400) NULL,
  ADD COLUMN IF NOT EXISTS `aadhar` varchar(30) NULL,
  ADD COLUMN IF NOT EXISTS `aadhar_image` varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS `pan` varchar(30) NULL,
  ADD COLUMN IF NOT EXISTS `pan_image` varchar(400) NULL,
  ADD COLUMN IF NOT EXISTS `bank_passbook` varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS `license_image` varchar(400) NULL,
  ADD COLUMN IF NOT EXISTS `rc_image` varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS `bank_name` varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS `account_number` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `ifsc_code` varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS `gpay` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `phonepe` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `paytm` varchar(50) NULL,
  ADD COLUMN IF NOT EXISTS `upi` varchar(100) NULL,
  ADD COLUMN IF NOT EXISTS `payment_link` varchar(550) NULL,
  ADD COLUMN IF NOT EXISTS `monthly_wallet` decimal(12,2) NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `lucky_wallet` decimal(12,2) NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `gift` decimal(12,2) NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `qr_wallet` decimal(12,2) NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `state_id` int(10) unsigned NULL,
  ADD COLUMN IF NOT EXISTS `district_id` int(10) unsigned NULL,
  ADD COLUMN IF NOT EXISTS `bill_address` varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS `bill_landmark` varchar(500) NULL,
  ADD COLUMN IF NOT EXISTS `id_card_url` longtext NULL,
  ADD COLUMN IF NOT EXISTS `kyc_status` varchar(20) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS `kyc_note` varchar(255) NULL,
  ADD COLUMN IF NOT EXISTS `account_holder` varchar(150) NULL,
  ADD COLUMN IF NOT EXISTS `welcome_1_wallet` decimal(12,2) NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `welcome_2_wallet` decimal(12,2) NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `welcome_3_wallet` decimal(12,2) NULL DEFAULT 0.00;

ALTER TABLE `vendor_categories`
  ADD COLUMN IF NOT EXISTS `free_delivery_min` decimal(10,2) NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `delivery_charge` decimal(10,2) NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS `gst_rate` decimal(5,2) NULL DEFAULT 0.00;

