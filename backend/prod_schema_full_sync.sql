-- ============================================================
-- PRODUCTION FULL SCHEMA SYNC   epey_v2 -> live (u290807677_sprithi_new)
-- Covers all 48 CI4 migration-defined app tables (legacy scratch excluded).
-- SAFE: idempotent (IF NOT EXISTS), STRUCTURE ONLY. No data touched, no DROP.
-- MariaDB syntax. If 'IF NOT EXISTS' on ALTER errors => MySQL 8; ask for the v8 build.
-- ============================================================

-- ===== 1) Tables (creates any missing table in full) =====
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `blog_posts` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `slug` varchar(160) NOT NULL,
  `title` varchar(200) NOT NULL,
  `excerpt` varchar(500) DEFAULT NULL,
  `cover_image` longtext DEFAULT NULL,
  `content` longtext DEFAULT NULL,
  `status` enum('draft','published') NOT NULL DEFAULT 'draft',
  `published_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `slug` (`slug`),
  KEY `status` (`status`),
  KEY `published_at` (`published_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `cart_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned NOT NULL,
  `variation_id` bigint(20) unsigned DEFAULT NULL,
  `qty` int(10) unsigned NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `user_id_product_id_variation_id` (`user_id`,`product_id`,`variation_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `categories` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `parent_id` int(10) unsigned DEFAULT NULL,
  `token_cost` int(10) unsigned DEFAULT 1,
  `vendor_category_id` int(10) unsigned DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_vendor_category_id` (`vendor_category_id`),
  KEY `idx_categories_name` (`name`),
  KEY `idx_categories_parent` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `delivery_km_slabs` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `taluk_id` int(10) unsigned NOT NULL,
  `from_km` decimal(8,2) NOT NULL,
  `to_km` decimal(8,2) NOT NULL,
  `price_per_km` decimal(10,2) NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `taluk_id` (`taluk_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `delivery_time_rates` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `taluk_id` int(10) unsigned NOT NULL,
  `time_min` int(10) unsigned NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `taluk_id` (`taluk_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `device_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `token` varchar(255) NOT NULL,
  `platform` enum('android','ios','web') NOT NULL DEFAULT 'android',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `token` (`token`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `distribute_tokens` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `from_user_id` bigint(20) unsigned NOT NULL,
  `to_user_id` bigint(20) unsigned NOT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tokens` decimal(12,2) DEFAULT 0.00,
  `bonus` decimal(12,2) DEFAULT 0.00,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `from_user_id` (`from_user_id`),
  KEY `to_user_id` (`to_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `districts` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `state_id` int(10) unsigned DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `state_id` (`state_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `email_subscriptions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(200) NOT NULL,
  `status` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `home_banners` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `slot` varchar(40) NOT NULL,
  `sort_order` int(11) NOT NULL DEFAULT 0,
  `eyebrow` varchar(120) DEFAULT NULL,
  `title` varchar(200) DEFAULT NULL,
  `highlight` varchar(200) DEFAULT NULL,
  `subtitle` varchar(255) DEFAULT NULL,
  `cta_label` varchar(60) DEFAULT NULL,
  `cta_href` varchar(255) DEFAULT NULL,
  `image_url` longtext DEFAULT NULL,
  `gradient_from` varchar(20) DEFAULT NULL,
  `gradient_mid` varchar(20) DEFAULT NULL,
  `gradient_to` varchar(20) DEFAULT NULL,
  `icon_name` varchar(40) DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `slot_status_sort_order` (`slot`,`status`,`sort_order`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `monthly_global_distributions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `pool_id` bigint(20) unsigned NOT NULL,
  `user_id` bigint(20) unsigned NOT NULL,
  `amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `pool_id_user_id` (`pool_id`,`user_id`),
  KEY `pool_id` (`pool_id`),
  KEY `user_id` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `monthly_global_pools` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `period` char(7) NOT NULL,
  `collected` decimal(14,2) NOT NULL DEFAULT 0.00,
  `distributed` decimal(14,2) NOT NULL DEFAULT 0.00,
  `eligible_count` int(10) unsigned NOT NULL DEFAULT 0,
  `per_user_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `distributed_at` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `period` (`period`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `monthly_lucky_draw_pools` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `period` char(7) NOT NULL,
  `collected` decimal(14,2) NOT NULL DEFAULT 0.00,
  `distributed` decimal(14,2) NOT NULL DEFAULT 0.00,
  `winner_user_id` bigint(20) unsigned DEFAULT NULL,
  `winner_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `distributed_at` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `period` (`period`),
  KEY `winner_user_id` (`winner_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `type` varchar(60) DEFAULT NULL,
  `title` varchar(200) NOT NULL,
  `body` text DEFAULT NULL,
  `entity_id` bigint(20) unsigned DEFAULT NULL,
  `route` varchar(255) DEFAULT NULL,
  `read_at` datetime DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `read_at` (`read_at`),
  KEY `type` (`type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `product_id` bigint(20) unsigned DEFAULT NULL,
  `variation_id` bigint(20) unsigned DEFAULT NULL,
  `variation_label` varchar(100) DEFAULT NULL,
  `name` varchar(200) NOT NULL,
  `qty` int(10) unsigned NOT NULL DEFAULT 1,
  `price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00,
  `commission_amount` decimal(11,2) DEFAULT 0.00,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `orders` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_group` varchar(40) DEFAULT NULL,
  `customer_id` bigint(20) unsigned NOT NULL,
  `vendor_id` bigint(20) unsigned DEFAULT NULL,
  `total` decimal(12,2) NOT NULL DEFAULT 0.00,
  `delivery_fee` decimal(10,2) DEFAULT 0.00,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `commission_distributed_at` datetime DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `order_number` varchar(50) DEFAULT NULL,
  `delivery_address` varchar(1000) DEFAULT NULL,
  `prescription_path` varchar(255) DEFAULT NULL,
  `bill_path` varchar(255) DEFAULT NULL,
  `bill_address` varchar(1000) DEFAULT NULL,
  `delivery_landmark` varchar(1000) DEFAULT NULL,
  `bill_landmark` varchar(1000) DEFAULT NULL,
  `payment_method` varchar(20) DEFAULT NULL,
  `delivery_date` varchar(100) DEFAULT NULL,
  `total_km` int(11) DEFAULT 0,
  `delivery_minutes` decimal(8,2) DEFAULT 0.00,
  `driver_id` bigint(20) unsigned DEFAULT NULL,
  `delivery_pincode` varchar(10) DEFAULT NULL,
  `km_slab_id` bigint(20) unsigned DEFAULT NULL,
  `pay_to_vendor` tinyint(1) DEFAULT 0,
  `pay_to_admin` tinyint(1) DEFAULT 0,
  `pay_to_delivery_person` tinyint(1) DEFAULT 0,
  `delivery_person_amount` decimal(11,2) DEFAULT 0.00,
  `delivered_at` datetime DEFAULT NULL,
  `cancel_reason` varchar(255) DEFAULT NULL,
  `cancelled_by` varchar(20) DEFAULT NULL,
  `cancelled_at` datetime DEFAULT NULL,
  `penalty` decimal(12,2) DEFAULT NULL,
  `qr_transferred_at` datetime DEFAULT NULL,
  `delivery_at` datetime DEFAULT NULL,
  `sale_mode` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `customer_id` (`customer_id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `status` (`status`),
  KEY `idx_orders_order_group` (`order_group`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `pincodes` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `code` varchar(10) NOT NULL,
  `district_id` int(10) unsigned DEFAULT NULL,
  `taluk_id` int(10) unsigned DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `code` (`code`),
  KEY `district_id` (`district_id`),
  KEY `taluk_id` (`taluk_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `product_variants` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `product_id` bigint(20) unsigned NOT NULL,
  `name` varchar(100) NOT NULL,
  `sku` varchar(64) DEFAULT NULL,
  `options` text DEFAULT NULL,
  `price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `stock` int(11) NOT NULL DEFAULT 0,
  `image` longtext DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `mrp` decimal(12,2) DEFAULT NULL,
  `barcode` varchar(64) DEFAULT NULL,
  `weight` decimal(12,3) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `products` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `vendor_id` bigint(20) unsigned NOT NULL,
  `category_id` int(10) unsigned DEFAULT NULL,
  `vendor_category_id` int(10) unsigned DEFAULT NULL,
  `name` varchar(200) NOT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(12,2) NOT NULL DEFAULT 0.00,
  `stock` int(11) NOT NULL DEFAULT 0,
  `image` longtext DEFAULT NULL,
  `attributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attributes`)),
  `has_variants` tinyint(1) NOT NULL DEFAULT 0,
  `variant_types` text DEFAULT NULL,
  `variant_images` longtext DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `mrp` decimal(12,2) DEFAULT NULL,
  `code` varchar(50) DEFAULT NULL,
  `barcode` varchar(50) DEFAULT NULL,
  `cost_price` decimal(18,2) DEFAULT NULL,
  `profit_percent` decimal(18,2) DEFAULT NULL,
  `profit` decimal(18,2) DEFAULT NULL,
  `basic_price` decimal(18,2) DEFAULT NULL,
  `discount_percent` decimal(18,2) DEFAULT NULL,
  `discount` decimal(18,2) DEFAULT NULL,
  `wholesale_profit_percent` decimal(18,2) DEFAULT NULL,
  `wholesale_profit` decimal(18,2) DEFAULT NULL,
  `wholesale_price` decimal(18,2) DEFAULT NULL,
  `incentive` decimal(18,2) DEFAULT NULL,
  `incentive_percent` decimal(18,2) DEFAULT NULL,
  `cashback` decimal(18,2) DEFAULT NULL,
  `cashback_percent` decimal(18,2) DEFAULT NULL,
  `net_profit` decimal(18,2) DEFAULT NULL,
  `tax_amount` decimal(18,2) DEFAULT NULL,
  `wholesales_2` decimal(18,2) DEFAULT NULL,
  `gst` decimal(18,2) DEFAULT NULL,
  `gst_value` decimal(18,2) DEFAULT NULL,
  `supplier_price` decimal(18,2) DEFAULT NULL,
  `agent_commission_perc` decimal(18,2) DEFAULT NULL,
  `agent_commission` decimal(18,2) DEFAULT NULL,
  `cess` decimal(18,2) DEFAULT NULL,
  `cess_rate` decimal(18,2) DEFAULT NULL,
  `covid` decimal(18,2) DEFAULT NULL,
  `covid_percent` decimal(18,2) DEFAULT NULL,
  `cost_price_exceed` decimal(18,2) DEFAULT NULL,
  `manual_rate` varchar(10) DEFAULT NULL,
  `tax_type` varchar(50) DEFAULT NULL,
  `agent` varchar(100) DEFAULT NULL,
  `csquare` varchar(50) DEFAULT NULL,
  `multi_pricing` varchar(50) DEFAULT NULL,
  `created_date` datetime DEFAULT NULL,
  `modified_date` datetime DEFAULT NULL,
  `tax_percentage` decimal(8,2) DEFAULT NULL,
  `discount_value` decimal(12,2) DEFAULT NULL,
  `discount_amount` decimal(12,2) DEFAULT NULL,
  `weight` decimal(12,3) DEFAULT NULL,
  `length` decimal(12,2) DEFAULT NULL,
  `width` decimal(12,2) DEFAULT NULL,
  `height` decimal(12,2) DEFAULT NULL,
  `delivery_charge` decimal(12,2) DEFAULT NULL,
  `min_stock_alert` int(11) DEFAULT NULL,
  `max_order_qty` int(11) DEFAULT NULL,
  `return_days` int(11) DEFAULT NULL,
  `warranty_days` int(11) DEFAULT NULL,
  `brand` varchar(120) DEFAULT NULL,
  `hsn_code` varchar(20) DEFAULT NULL,
  `discount_type` varchar(20) DEFAULT NULL,
  `unit` varchar(20) DEFAULT NULL,
  `short_description` varchar(300) DEFAULT NULL,
  `tags` varchar(500) DEFAULT NULL,
  `gallery_images` text DEFAULT NULL,
  `featured` tinyint(1) DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `vendor_id` (`vendor_id`),
  KEY `category_id` (`category_id`),
  KEY `status` (`status`),
  KEY `idx_vendor_category_id` (`vendor_category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `purchase_commissions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `order_id` bigint(20) unsigned NOT NULL,
  `beneficiary_id` bigint(20) unsigned NOT NULL,
  `source_user_id` bigint(20) unsigned NOT NULL,
  `level` tinyint(4) NOT NULL,
  `buyback_cycle_id` bigint(20) unsigned DEFAULT NULL,
  `percent` decimal(6,2) NOT NULL DEFAULT 0.00,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `order_id` (`order_id`),
  KEY `beneficiary_id` (`beneficiary_id`),
  KEY `source_user_id` (`source_user_id`),
  KEY `pc_buyback_cycle` (`buyback_cycle_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `referrals` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `referrer_id` bigint(20) unsigned NOT NULL,
  `referred_id` bigint(20) unsigned NOT NULL,
  `level` tinyint(3) unsigned NOT NULL DEFAULT 1,
  `bonus_amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `referrer_id_referred_id` (`referrer_id`,`referred_id`),
  KEY `referrer_id` (`referrer_id`),
  KEY `referred_id` (`referred_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `states` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `system_pools` (
  `pool_key` varchar(50) NOT NULL,
  `balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`pool_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` varchar(80) NOT NULL,
  `value` text DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `taluks` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `district_id` int(10) unsigned NOT NULL,
  `name` varchar(100) NOT NULL,
  `user_id` bigint(20) unsigned DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `district_id` (`district_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `token_request_events` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `request_id` bigint(20) unsigned NOT NULL,
  `actor_id` bigint(20) unsigned DEFAULT NULL,
  `action` varchar(20) NOT NULL,
  `from_level` varchar(20) DEFAULT NULL,
  `to_level` varchar(20) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `request_id` (`request_id`),
  KEY `actor_id` (`actor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `token_requests` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `requester_id` bigint(20) unsigned NOT NULL,
  `target_user_id` bigint(20) unsigned DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL DEFAULT 0.00,
  `tokens` decimal(12,2) DEFAULT 0.00,
  `status` varchar(20) NOT NULL DEFAULT 'pending',
  `current_level` varchar(20) DEFAULT 'taluk',
  `processed_by` bigint(20) unsigned DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `attachment` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `requester_id` (`requester_id`),
  KEY `target_user_id` (`target_user_id`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `users` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `tenant_id` int(10) unsigned DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `email` varchar(150) DEFAULT NULL,
  `mobile_number` varchar(15) NOT NULL,
  `password_hash` varchar(255) NOT NULL,
  `legacy_password` varchar(255) DEFAULT NULL,
  `password_reset_token` varchar(64) DEFAULT NULL,
  `password_reset_expires_at` datetime DEFAULT NULL,
  `role` enum('customer','vendor','taluk','district','state','driver','admin') NOT NULL DEFAULT 'customer',
  `status` enum('active','inactive','blocked') NOT NULL DEFAULT 'active',
  `pincode` varchar(10) DEFAULT NULL,
  `dob` datetime DEFAULT NULL,
  `address_line` varchar(255) DEFAULT NULL,
  `landmark` varchar(100) DEFAULT NULL,
  `city` varchar(80) DEFAULT NULL,
  `vehicle_number` varchar(20) DEFAULT NULL,
  `license_number` varchar(50) DEFAULT NULL,
  `monthly_salary` decimal(12,2) NOT NULL DEFAULT 0.00,
  `km_rate` decimal(8,2) NOT NULL DEFAULT 0.00,
  `hour_rate` decimal(8,2) NOT NULL DEFAULT 0.00,
  `shift` varchar(50) DEFAULT NULL,
  `taluk_id` int(10) unsigned DEFAULT NULL,
  `assigned_vendor_id` bigint(20) unsigned DEFAULT NULL,
  `referrer_id` bigint(20) unsigned DEFAULT NULL,
  `level_1_count` int(10) unsigned NOT NULL DEFAULT 0,
  `level_2_count` int(10) unsigned NOT NULL DEFAULT 0,
  `level_3_count` int(10) unsigned NOT NULL DEFAULT 0,
  `wallet_balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `level_wallet` decimal(12,2) NOT NULL DEFAULT 0.00,
  `level_1_wallet` decimal(12,2) NOT NULL DEFAULT 0.00,
  `level_2_wallet` decimal(12,2) NOT NULL DEFAULT 0.00,
  `level_3_wallet` decimal(12,2) NOT NULL DEFAULT 0.00,
  `buyback_wallet` decimal(12,2) NOT NULL DEFAULT 0.00,
  `buyback_next_slot` tinyint(3) unsigned DEFAULT 0,
  `global_wallet` decimal(12,2) NOT NULL DEFAULT 0.00,
  `token_balance` decimal(12,2) DEFAULT 0.00,
  `bonus_balance` decimal(12,2) NOT NULL DEFAULT 0.00,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `deleted_at` datetime DEFAULT NULL,
  `is_super_admin` tinyint(1) NOT NULL DEFAULT 0,
  `created_by` int(10) unsigned DEFAULT NULL,
  `image` varchar(400) DEFAULT NULL,
  `aadhar` varchar(30) DEFAULT NULL,
  `aadhar_image` varchar(500) DEFAULT NULL,
  `pan` varchar(30) DEFAULT NULL,
  `pan_image` varchar(400) DEFAULT NULL,
  `bank_passbook` varchar(500) DEFAULT NULL,
  `license_image` varchar(400) DEFAULT NULL,
  `rc_image` varchar(500) DEFAULT NULL,
  `bank_name` varchar(100) DEFAULT NULL,
  `account_number` varchar(50) DEFAULT NULL,
  `ifsc_code` varchar(100) DEFAULT NULL,
  `gpay` varchar(50) DEFAULT NULL,
  `phonepe` varchar(50) DEFAULT NULL,
  `paytm` varchar(50) DEFAULT NULL,
  `upi` varchar(100) DEFAULT NULL,
  `payment_link` varchar(550) DEFAULT NULL,
  `monthly_wallet` decimal(12,2) DEFAULT 0.00,
  `lucky_wallet` decimal(12,2) DEFAULT 0.00,
  `gift` decimal(12,2) DEFAULT 0.00,
  `qr_wallet` decimal(12,2) DEFAULT 0.00,
  `state_id` int(10) unsigned DEFAULT NULL,
  `district_id` int(10) unsigned DEFAULT NULL,
  `bill_address` varchar(500) DEFAULT NULL,
  `bill_landmark` varchar(500) DEFAULT NULL,
  `id_card_url` longtext DEFAULT NULL,
  `kyc_status` varchar(20) NOT NULL DEFAULT 'none',
  `kyc_note` varchar(255) DEFAULT NULL,
  `account_holder` varchar(150) DEFAULT NULL,
  `welcome_1_wallet` decimal(12,2) DEFAULT 0.00,
  `welcome_2_wallet` decimal(12,2) DEFAULT 0.00,
  `welcome_3_wallet` decimal(12,2) DEFAULT 0.00,
  PRIMARY KEY (`id`),
  UNIQUE KEY `mobile_number_role` (`mobile_number`,`role`),
  KEY `email` (`email`),
  KEY `role` (`role`),
  KEY `status` (`status`),
  KEY `referrer_id` (`referrer_id`),
  KEY `users_tenant_idx` (`tenant_id`),
  KEY `users_created_by_idx` (`created_by`),
  KEY `idx_pw_reset_token` (`password_reset_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `variant_type_groups` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `category_id` int(10) unsigned DEFAULT NULL,
  `fields` text DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`),
  KEY `idx_category_id` (`category_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `vendor_categories` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `image` longtext DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `free_delivery_min` decimal(10,2) DEFAULT 0.00,
  `delivery_charge` decimal(10,2) DEFAULT 0.00,
  `gst_rate` decimal(5,2) DEFAULT 0.00,
  `display_order` int(10) unsigned NOT NULL DEFAULT 0,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `vendor_profiles` (
  `user_id` bigint(20) unsigned NOT NULL,
  `vendor_category_id` int(10) unsigned DEFAULT NULL,
  `commission_pct` decimal(5,2) DEFAULT 10.00,
  `shop_name` varchar(150) NOT NULL,
  `address` varchar(255) DEFAULT NULL,
  `area` varchar(100) DEFAULT NULL,
  `state_id` int(10) unsigned DEFAULT NULL,
  `district_id` int(10) unsigned DEFAULT NULL,
  `taluk_id` int(10) unsigned DEFAULT NULL,
  `pincode` varchar(10) DEFAULT NULL,
  `gst` varchar(20) DEFAULT NULL,
  `image` longtext DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `banner_image` varchar(500) DEFAULT NULL,
  `trade_mark` varchar(500) DEFAULT NULL,
  `image_pending` varchar(255) DEFAULT NULL,
  `image_status` varchar(20) DEFAULT NULL,
  `image_reject_reason` varchar(255) DEFAULT NULL,
  `image_reviewed_by` bigint(20) unsigned DEFAULT NULL,
  PRIMARY KEY (`user_id`),
  KEY `vendor_category_id` (`vendor_category_id`),
  KEY `state_id` (`state_id`),
  KEY `district_id` (`district_id`),
  KEY `taluk_id` (`taluk_id`),
  KEY `pincode` (`pincode`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
CREATE TABLE IF NOT EXISTS `wallet_transactions` (
  `id` bigint(20) unsigned NOT NULL AUTO_INCREMENT,
  `user_id` bigint(20) unsigned NOT NULL,
  `peer_user_id` bigint(20) unsigned DEFAULT NULL,
  `amount` decimal(12,2) NOT NULL,
  `type` varchar(40) NOT NULL,
  `wallet` varchar(20) DEFAULT NULL,
  `reference` varchar(80) DEFAULT NULL,
  `notes` varchar(255) DEFAULT NULL,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `type` (`type`),
  KEY `peer_user_id` (`peer_user_id`),
  KEY `idx_wt_user_wallet` (`user_id`,`wallet`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8 */;
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
/*!40101 SET character_set_client = @saved_cs_client */;

-- ===== 2) Columns (adds any missing column to existing tables) =====
ALTER TABLE `ad_requests` ADD COLUMN IF NOT EXISTS `vendor_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `ad_requests` ADD COLUMN IF NOT EXISTS `type` varchar(10) NOT NULL;
ALTER TABLE `ad_requests` ADD COLUMN IF NOT EXISTS `attachment` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `ad_requests` ADD COLUMN IF NOT EXISTS `notes` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `ad_requests` ADD COLUMN IF NOT EXISTS `status` varchar(20) NOT NULL DEFAULT 'pending';
ALTER TABLE `ad_requests` ADD COLUMN IF NOT EXISTS `processed_by` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `ad_requests` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `ad_requests` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `blog_posts` ADD COLUMN IF NOT EXISTS `slug` varchar(160) NOT NULL;
ALTER TABLE `blog_posts` ADD COLUMN IF NOT EXISTS `title` varchar(200) NOT NULL;
ALTER TABLE `blog_posts` ADD COLUMN IF NOT EXISTS `excerpt` varchar(500) NULL DEFAULT NULL;
ALTER TABLE `blog_posts` ADD COLUMN IF NOT EXISTS `cover_image` longtext NULL DEFAULT NULL;
ALTER TABLE `blog_posts` ADD COLUMN IF NOT EXISTS `content` longtext NULL DEFAULT NULL;
ALTER TABLE `blog_posts` ADD COLUMN IF NOT EXISTS `status` enum('draft','published') NOT NULL DEFAULT 'draft';
ALTER TABLE `blog_posts` ADD COLUMN IF NOT EXISTS `published_at` datetime NULL DEFAULT NULL;
ALTER TABLE `blog_posts` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `blog_posts` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `blog_posts` ADD COLUMN IF NOT EXISTS `deleted_at` datetime NULL DEFAULT NULL;
ALTER TABLE `buyback_cycles` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `buyback_cycles` ADD COLUMN IF NOT EXISTS `next_slot` tinyint(3) unsigned NOT NULL DEFAULT 1;
ALTER TABLE `buyback_cycles` ADD COLUMN IF NOT EXISTS `status` varchar(20) NOT NULL DEFAULT 'open';
ALTER TABLE `buyback_cycles` ADD COLUMN IF NOT EXISTS `opened_at` datetime NULL DEFAULT NULL;
ALTER TABLE `buyback_cycles` ADD COLUMN IF NOT EXISTS `completed_at` datetime NULL DEFAULT NULL;
ALTER TABLE `buyback_cycles` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `buyback_cycles` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `cart_items` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `cart_items` ADD COLUMN IF NOT EXISTS `product_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `cart_items` ADD COLUMN IF NOT EXISTS `variation_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `cart_items` ADD COLUMN IF NOT EXISTS `qty` int(10) unsigned NOT NULL DEFAULT 1;
ALTER TABLE `cart_items` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `cart_items` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `name` varchar(100) NOT NULL;
ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `parent_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `token_cost` int(10) unsigned NULL DEFAULT 1;
ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `vendor_category_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `status` enum('active','inactive') NOT NULL DEFAULT 'active';
ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `customer_delivery_addresses` ADD COLUMN IF NOT EXISTS `customer_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `customer_delivery_addresses` ADD COLUMN IF NOT EXISTS `address_line` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `customer_delivery_addresses` ADD COLUMN IF NOT EXISTS `landmark` varchar(100) NULL DEFAULT NULL;
ALTER TABLE `customer_delivery_addresses` ADD COLUMN IF NOT EXISTS `city` varchar(80) NULL DEFAULT NULL;
ALTER TABLE `customer_delivery_addresses` ADD COLUMN IF NOT EXISTS `pincode` varchar(10) NULL DEFAULT NULL;
ALTER TABLE `customer_delivery_addresses` ADD COLUMN IF NOT EXISTS `is_default` tinyint(1) NOT NULL DEFAULT 0;
ALTER TABLE `customer_delivery_addresses` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `customer_delivery_addresses` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `customer_videos` ADD COLUMN IF NOT EXISTS `title` varchar(200) NULL DEFAULT NULL;
ALTER TABLE `customer_videos` ADD COLUMN IF NOT EXISTS `video_path` varchar(255) NOT NULL;
ALTER TABLE `customer_videos` ADD COLUMN IF NOT EXISTS `sort_order` int(11) NOT NULL DEFAULT 0;
ALTER TABLE `customer_videos` ADD COLUMN IF NOT EXISTS `status` varchar(20) NOT NULL DEFAULT 'active';
ALTER TABLE `customer_videos` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `customer_videos` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `customer_videos` ADD COLUMN IF NOT EXISTS `submitted_by` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `customer_wishlist` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `customer_wishlist` ADD COLUMN IF NOT EXISTS `vendor_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `customer_wishlist` ADD COLUMN IF NOT EXISTS `product_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `customer_wishlist` ADD COLUMN IF NOT EXISTS `variant_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `customer_wishlist` ADD COLUMN IF NOT EXISTS `status` tinyint(1) NOT NULL DEFAULT 1;
ALTER TABLE `customer_wishlist` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `delivery_km_slabs` ADD COLUMN IF NOT EXISTS `taluk_id` int(10) unsigned NOT NULL;
ALTER TABLE `delivery_km_slabs` ADD COLUMN IF NOT EXISTS `from_km` decimal(8,2) NOT NULL;
ALTER TABLE `delivery_km_slabs` ADD COLUMN IF NOT EXISTS `to_km` decimal(8,2) NOT NULL;
ALTER TABLE `delivery_km_slabs` ADD COLUMN IF NOT EXISTS `price_per_km` decimal(10,2) NOT NULL;
ALTER TABLE `delivery_km_slabs` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `delivery_km_slabs` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `delivery_time_rates` ADD COLUMN IF NOT EXISTS `taluk_id` int(10) unsigned NOT NULL;
ALTER TABLE `delivery_time_rates` ADD COLUMN IF NOT EXISTS `time_min` int(10) unsigned NOT NULL;
ALTER TABLE `delivery_time_rates` ADD COLUMN IF NOT EXISTS `price` decimal(10,2) NOT NULL;
ALTER TABLE `delivery_time_rates` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `delivery_time_rates` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `device_tokens` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `device_tokens` ADD COLUMN IF NOT EXISTS `token` varchar(255) NOT NULL;
ALTER TABLE `device_tokens` ADD COLUMN IF NOT EXISTS `platform` enum('android','ios','web') NOT NULL DEFAULT 'android';
ALTER TABLE `device_tokens` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `device_tokens` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `distribute_tokens` ADD COLUMN IF NOT EXISTS `from_user_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `distribute_tokens` ADD COLUMN IF NOT EXISTS `to_user_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `distribute_tokens` ADD COLUMN IF NOT EXISTS `amount` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `distribute_tokens` ADD COLUMN IF NOT EXISTS `tokens` decimal(12,2) NULL DEFAULT 0.00;
ALTER TABLE `distribute_tokens` ADD COLUMN IF NOT EXISTS `bonus` decimal(12,2) NULL DEFAULT 0.00;
ALTER TABLE `distribute_tokens` ADD COLUMN IF NOT EXISTS `notes` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `distribute_tokens` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `districts` ADD COLUMN IF NOT EXISTS `state_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `districts` ADD COLUMN IF NOT EXISTS `name` varchar(100) NOT NULL;
ALTER TABLE `districts` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `districts` ADD COLUMN IF NOT EXISTS `status` enum('active','inactive') NOT NULL DEFAULT 'active';
ALTER TABLE `districts` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `districts` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `driver_shifts` ADD COLUMN IF NOT EXISTS `name` varchar(50) NOT NULL;
ALTER TABLE `driver_shifts` ADD COLUMN IF NOT EXISTS `start_time` time NULL DEFAULT NULL;
ALTER TABLE `driver_shifts` ADD COLUMN IF NOT EXISTS `end_time` time NULL DEFAULT NULL;
ALTER TABLE `driver_shifts` ADD COLUMN IF NOT EXISTS `is_active` tinyint(1) NOT NULL DEFAULT 1;
ALTER TABLE `driver_shifts` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `driver_shifts` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `email_subscriptions` ADD COLUMN IF NOT EXISTS `email` varchar(200) NOT NULL;
ALTER TABLE `email_subscriptions` ADD COLUMN IF NOT EXISTS `status` tinyint(1) NOT NULL DEFAULT 1;
ALTER TABLE `email_subscriptions` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `slot` varchar(40) NOT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `sort_order` int(11) NOT NULL DEFAULT 0;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `eyebrow` varchar(120) NULL DEFAULT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `title` varchar(200) NULL DEFAULT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `highlight` varchar(200) NULL DEFAULT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `subtitle` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `cta_label` varchar(60) NULL DEFAULT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `cta_href` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `image_url` longtext NULL DEFAULT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `gradient_from` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `gradient_mid` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `gradient_to` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `icon_name` varchar(40) NULL DEFAULT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `status` enum('active','inactive') NOT NULL DEFAULT 'active';
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `home_banners` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `legacy_id_map` ADD COLUMN IF NOT EXISTS `old_table` varchar(50) NOT NULL;
ALTER TABLE `legacy_id_map` ADD COLUMN IF NOT EXISTS `old_id` int(11) NOT NULL;
ALTER TABLE `legacy_id_map` ADD COLUMN IF NOT EXISTS `new_table` varchar(50) NOT NULL;
ALTER TABLE `legacy_id_map` ADD COLUMN IF NOT EXISTS `new_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `legacy_id_map` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `lucky_draw_entries` ADD COLUMN IF NOT EXISTS `vendor_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `lucky_draw_entries` ADD COLUMN IF NOT EXISTS `taluk_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `lucky_draw_entries` ADD COLUMN IF NOT EXISTS `set_number` int(11) NOT NULL DEFAULT 0;
ALTER TABLE `lucky_draw_entries` ADD COLUMN IF NOT EXISTS `refer_code` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `lucky_draw_entries` ADD COLUMN IF NOT EXISTS `mobile_number` varchar(15) NULL DEFAULT NULL;
ALTER TABLE `lucky_draw_entries` ADD COLUMN IF NOT EXISTS `status` tinyint(1) NOT NULL DEFAULT 1;
ALTER TABLE `lucky_draw_entries` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `monthly_global_distributions` ADD COLUMN IF NOT EXISTS `pool_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `monthly_global_distributions` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `monthly_global_distributions` ADD COLUMN IF NOT EXISTS `amount` decimal(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `monthly_global_distributions` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `monthly_global_pools` ADD COLUMN IF NOT EXISTS `period` char(7) NOT NULL;
ALTER TABLE `monthly_global_pools` ADD COLUMN IF NOT EXISTS `collected` decimal(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `monthly_global_pools` ADD COLUMN IF NOT EXISTS `distributed` decimal(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `monthly_global_pools` ADD COLUMN IF NOT EXISTS `eligible_count` int(10) unsigned NOT NULL DEFAULT 0;
ALTER TABLE `monthly_global_pools` ADD COLUMN IF NOT EXISTS `per_user_amount` decimal(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `monthly_global_pools` ADD COLUMN IF NOT EXISTS `distributed_at` datetime NULL DEFAULT NULL;
ALTER TABLE `monthly_global_pools` ADD COLUMN IF NOT EXISTS `notes` text NULL DEFAULT NULL;
ALTER TABLE `monthly_global_pools` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `monthly_global_pools` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `monthly_lucky_draw_pools` ADD COLUMN IF NOT EXISTS `period` char(7) NOT NULL;
ALTER TABLE `monthly_lucky_draw_pools` ADD COLUMN IF NOT EXISTS `collected` decimal(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `monthly_lucky_draw_pools` ADD COLUMN IF NOT EXISTS `distributed` decimal(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `monthly_lucky_draw_pools` ADD COLUMN IF NOT EXISTS `winner_user_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `monthly_lucky_draw_pools` ADD COLUMN IF NOT EXISTS `winner_amount` decimal(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `monthly_lucky_draw_pools` ADD COLUMN IF NOT EXISTS `distributed_at` datetime NULL DEFAULT NULL;
ALTER TABLE `monthly_lucky_draw_pools` ADD COLUMN IF NOT EXISTS `notes` text NULL DEFAULT NULL;
ALTER TABLE `monthly_lucky_draw_pools` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `monthly_lucky_draw_pools` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `type` varchar(60) NULL DEFAULT NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `title` varchar(200) NOT NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `body` text NULL DEFAULT NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `entity_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `route` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `read_at` datetime NULL DEFAULT NULL;
ALTER TABLE `notifications` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `order_group` varchar(40) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `customer_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `vendor_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `total` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `delivery_fee` decimal(10,2) NULL DEFAULT 0.00;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `status` varchar(20) NOT NULL DEFAULT 'pending';
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `commission_distributed_at` datetime NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `notes` text NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `order_number` varchar(50) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `delivery_address` varchar(1000) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `prescription_path` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `bill_path` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `bill_address` varchar(1000) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `delivery_landmark` varchar(1000) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `bill_landmark` varchar(1000) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `payment_method` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `delivery_date` varchar(100) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `total_km` int(11) NULL DEFAULT 0;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `delivery_minutes` decimal(8,2) NULL DEFAULT 0.00;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `driver_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `delivery_pincode` varchar(10) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `km_slab_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `pay_to_vendor` tinyint(1) NULL DEFAULT 0;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `pay_to_admin` tinyint(1) NULL DEFAULT 0;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `pay_to_delivery_person` tinyint(1) NULL DEFAULT 0;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `delivery_person_amount` decimal(11,2) NULL DEFAULT 0.00;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `delivered_at` datetime NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `cancel_reason` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `cancelled_by` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `cancelled_at` datetime NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `penalty` decimal(12,2) NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `qr_transferred_at` datetime NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `delivery_at` datetime NULL DEFAULT NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `sale_mode` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `order_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `product_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `variation_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `variation_label` varchar(100) NULL DEFAULT NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `name` varchar(200) NOT NULL;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `qty` int(10) unsigned NOT NULL DEFAULT 1;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `price` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `subtotal` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `order_items` ADD COLUMN IF NOT EXISTS `commission_amount` decimal(11,2) NULL DEFAULT 0.00;
ALTER TABLE `order_returns` ADD COLUMN IF NOT EXISTS `order_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `order_returns` ADD COLUMN IF NOT EXISTS `customer_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `order_returns` ADD COLUMN IF NOT EXISTS `reason` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `order_returns` ADD COLUMN IF NOT EXISTS `status` varchar(20) NOT NULL DEFAULT 'pending';
ALTER TABLE `order_returns` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `order_returns` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `otp_codes` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `otp_codes` ADD COLUMN IF NOT EXISTS `mobile_number` varchar(15) NOT NULL;
ALTER TABLE `otp_codes` ADD COLUMN IF NOT EXISTS `otp` varchar(10) NOT NULL;
ALTER TABLE `otp_codes` ADD COLUMN IF NOT EXISTS `expires_at` datetime NULL DEFAULT NULL;
ALTER TABLE `otp_codes` ADD COLUMN IF NOT EXISTS `used_at` datetime NULL DEFAULT NULL;
ALTER TABLE `otp_codes` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `pincodes` ADD COLUMN IF NOT EXISTS `code` varchar(10) NOT NULL;
ALTER TABLE `pincodes` ADD COLUMN IF NOT EXISTS `district_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `pincodes` ADD COLUMN IF NOT EXISTS `taluk_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `pincodes` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `pincodes` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `vendor_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `category_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `vendor_category_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `name` varchar(200) NOT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `description` text NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `price` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `stock` int(11) NOT NULL DEFAULT 0;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `image` longtext NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `attributes` longtext NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `has_variants` tinyint(1) NOT NULL DEFAULT 0;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `variant_types` text NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `variant_images` longtext NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `status` enum('active','inactive') NOT NULL DEFAULT 'active';
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `deleted_at` datetime NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `mrp` decimal(12,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `code` varchar(50) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `barcode` varchar(50) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `cost_price` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `profit_percent` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `profit` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `basic_price` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `discount_percent` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `discount` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `wholesale_profit_percent` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `wholesale_profit` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `wholesale_price` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `incentive` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `incentive_percent` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `cashback` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `cashback_percent` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `net_profit` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `tax_amount` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `wholesales_2` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `gst` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `gst_value` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `supplier_price` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `agent_commission_perc` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `agent_commission` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `cess` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `cess_rate` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `covid` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `covid_percent` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `cost_price_exceed` decimal(18,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `manual_rate` varchar(10) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `tax_type` varchar(50) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `agent` varchar(100) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `csquare` varchar(50) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `multi_pricing` varchar(50) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `created_date` datetime NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `modified_date` datetime NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `tax_percentage` decimal(8,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `discount_value` decimal(12,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `discount_amount` decimal(12,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `weight` decimal(12,3) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `length` decimal(12,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `width` decimal(12,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `height` decimal(12,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `delivery_charge` decimal(12,2) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `min_stock_alert` int(11) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `max_order_qty` int(11) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `return_days` int(11) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `warranty_days` int(11) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `brand` varchar(120) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `hsn_code` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `discount_type` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `unit` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `short_description` varchar(300) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `tags` varchar(500) NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `gallery_images` text NULL DEFAULT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `featured` tinyint(1) NULL DEFAULT 0;
ALTER TABLE `product_reviews` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `product_reviews` ADD COLUMN IF NOT EXISTS `product_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `product_reviews` ADD COLUMN IF NOT EXISTS `variant_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `product_reviews` ADD COLUMN IF NOT EXISTS `rating` int(11) NOT NULL DEFAULT 0;
ALTER TABLE `product_reviews` ADD COLUMN IF NOT EXISTS `review` longtext NULL DEFAULT NULL;
ALTER TABLE `product_reviews` ADD COLUMN IF NOT EXISTS `image` longtext NULL DEFAULT NULL;
ALTER TABLE `product_reviews` ADD COLUMN IF NOT EXISTS `status` tinyint(1) NOT NULL DEFAULT 1;
ALTER TABLE `product_reviews` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `product_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `name` varchar(100) NOT NULL;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `sku` varchar(64) NULL DEFAULT NULL;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `options` text NULL DEFAULT NULL;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `price` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `stock` int(11) NOT NULL DEFAULT 0;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `image` longtext NULL DEFAULT NULL;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `status` enum('active','inactive') NOT NULL DEFAULT 'active';
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `mrp` decimal(12,2) NULL DEFAULT NULL;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `barcode` varchar(64) NULL DEFAULT NULL;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `weight` decimal(12,3) NULL DEFAULT NULL;
ALTER TABLE `purchase_commissions` ADD COLUMN IF NOT EXISTS `order_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `purchase_commissions` ADD COLUMN IF NOT EXISTS `beneficiary_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `purchase_commissions` ADD COLUMN IF NOT EXISTS `source_user_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `purchase_commissions` ADD COLUMN IF NOT EXISTS `level` tinyint(4) NOT NULL;
ALTER TABLE `purchase_commissions` ADD COLUMN IF NOT EXISTS `buyback_cycle_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `purchase_commissions` ADD COLUMN IF NOT EXISTS `percent` decimal(6,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `purchase_commissions` ADD COLUMN IF NOT EXISTS `amount` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `purchase_commissions` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `qr_requests` ADD COLUMN IF NOT EXISTS `vendor_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `qr_requests` ADD COLUMN IF NOT EXISTS `customer_mobile` varchar(15) NULL DEFAULT NULL;
ALTER TABLE `qr_requests` ADD COLUMN IF NOT EXISTS `amount` decimal(11,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `qr_requests` ADD COLUMN IF NOT EXISTS `status` tinyint(2) NOT NULL DEFAULT 0;
ALTER TABLE `qr_requests` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `referrals` ADD COLUMN IF NOT EXISTS `referrer_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `referrals` ADD COLUMN IF NOT EXISTS `referred_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `referrals` ADD COLUMN IF NOT EXISTS `level` tinyint(3) unsigned NOT NULL DEFAULT 1;
ALTER TABLE `referrals` ADD COLUMN IF NOT EXISTS `bonus_amount` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `referrals` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `states` ADD COLUMN IF NOT EXISTS `name` varchar(100) NOT NULL;
ALTER TABLE `states` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `states` ADD COLUMN IF NOT EXISTS `status` enum('active','inactive') NOT NULL DEFAULT 'active';
ALTER TABLE `states` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `states` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `support_tickets` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `support_tickets` ADD COLUMN IF NOT EXISTS `ticket_number` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `support_tickets` ADD COLUMN IF NOT EXISTS `type` int(11) NULL DEFAULT NULL;
ALTER TABLE `support_tickets` ADD COLUMN IF NOT EXISTS `title` varchar(250) NULL DEFAULT NULL;
ALTER TABLE `support_tickets` ADD COLUMN IF NOT EXISTS `description` text NULL DEFAULT NULL;
ALTER TABLE `support_tickets` ADD COLUMN IF NOT EXISTS `image` varchar(250) NULL DEFAULT NULL;
ALTER TABLE `support_tickets` ADD COLUMN IF NOT EXISTS `reply` longtext NULL DEFAULT NULL;
ALTER TABLE `support_tickets` ADD COLUMN IF NOT EXISTS `status` tinyint(2) NOT NULL DEFAULT 0;
ALTER TABLE `support_tickets` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `system_pools` ADD COLUMN IF NOT EXISTS `pool_key` varchar(50) NOT NULL;
ALTER TABLE `system_pools` ADD COLUMN IF NOT EXISTS `balance` decimal(14,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `system_pools` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `system_settings` ADD COLUMN IF NOT EXISTS `setting_key` varchar(80) NOT NULL;
ALTER TABLE `system_settings` ADD COLUMN IF NOT EXISTS `value` text NULL DEFAULT NULL;
ALTER TABLE `system_settings` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `taluks` ADD COLUMN IF NOT EXISTS `district_id` int(10) unsigned NOT NULL;
ALTER TABLE `taluks` ADD COLUMN IF NOT EXISTS `name` varchar(100) NOT NULL;
ALTER TABLE `taluks` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `taluks` ADD COLUMN IF NOT EXISTS `status` enum('active','inactive') NOT NULL DEFAULT 'active';
ALTER TABLE `taluks` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `taluks` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `taluk_banners` ADD COLUMN IF NOT EXISTS `taluk_id` int(10) unsigned NOT NULL;
ALTER TABLE `taluk_banners` ADD COLUMN IF NOT EXISTS `banner_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `taluk_banners` ADD COLUMN IF NOT EXISTS `text` varchar(100) NULL DEFAULT NULL;
ALTER TABLE `taluk_banners` ADD COLUMN IF NOT EXISTS `image` varchar(500) NULL DEFAULT NULL;
ALTER TABLE `taluk_banners` ADD COLUMN IF NOT EXISTS `link` varchar(1000) NULL DEFAULT NULL;
ALTER TABLE `taluk_banners` ADD COLUMN IF NOT EXISTS `status` tinyint(1) NOT NULL DEFAULT 1;
ALTER TABLE `taluk_banners` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `token_requests` ADD COLUMN IF NOT EXISTS `requester_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `token_requests` ADD COLUMN IF NOT EXISTS `target_user_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `token_requests` ADD COLUMN IF NOT EXISTS `amount` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `token_requests` ADD COLUMN IF NOT EXISTS `tokens` decimal(12,2) NULL DEFAULT 0.00;
ALTER TABLE `token_requests` ADD COLUMN IF NOT EXISTS `status` varchar(20) NOT NULL DEFAULT 'pending';
ALTER TABLE `token_requests` ADD COLUMN IF NOT EXISTS `current_level` varchar(20) NULL DEFAULT 'taluk';
ALTER TABLE `token_requests` ADD COLUMN IF NOT EXISTS `processed_by` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `token_requests` ADD COLUMN IF NOT EXISTS `notes` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `token_requests` ADD COLUMN IF NOT EXISTS `attachment` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `token_requests` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `token_requests` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `token_request_events` ADD COLUMN IF NOT EXISTS `request_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `token_request_events` ADD COLUMN IF NOT EXISTS `actor_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `token_request_events` ADD COLUMN IF NOT EXISTS `action` varchar(20) NOT NULL;
ALTER TABLE `token_request_events` ADD COLUMN IF NOT EXISTS `from_level` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `token_request_events` ADD COLUMN IF NOT EXISTS `to_level` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `token_request_events` ADD COLUMN IF NOT EXISTS `notes` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `token_request_events` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `tenant_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `name` varchar(100) NOT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `email` varchar(150) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `mobile_number` varchar(15) NOT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `password_hash` varchar(255) NOT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `legacy_password` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `password_reset_token` varchar(64) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `password_reset_expires_at` datetime NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `role` enum('customer','vendor','taluk','district','state','driver','admin') NOT NULL DEFAULT 'customer';
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `status` enum('active','inactive','blocked') NOT NULL DEFAULT 'active';
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `pincode` varchar(10) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `dob` datetime NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `address_line` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `landmark` varchar(100) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `city` varchar(80) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `vehicle_number` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `license_number` varchar(50) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `monthly_salary` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `km_rate` decimal(8,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `hour_rate` decimal(8,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `shift` varchar(50) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `taluk_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `assigned_vendor_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `referrer_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `level_1_count` int(10) unsigned NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `level_2_count` int(10) unsigned NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `level_3_count` int(10) unsigned NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `wallet_balance` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `level_wallet` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `level_1_wallet` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `level_2_wallet` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `level_3_wallet` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `buyback_wallet` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `buyback_next_slot` tinyint(3) unsigned NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `global_wallet` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `token_balance` decimal(12,2) NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `bonus_balance` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `deleted_at` datetime NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `is_super_admin` tinyint(1) NOT NULL DEFAULT 0;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `created_by` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `image` varchar(400) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `aadhar` varchar(30) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `aadhar_image` varchar(500) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `pan` varchar(30) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `pan_image` varchar(400) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `bank_passbook` varchar(500) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `license_image` varchar(400) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `rc_image` varchar(500) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `bank_name` varchar(100) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `account_number` varchar(50) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `ifsc_code` varchar(100) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `gpay` varchar(50) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `phonepe` varchar(50) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `paytm` varchar(50) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `upi` varchar(100) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `payment_link` varchar(550) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `monthly_wallet` decimal(12,2) NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `lucky_wallet` decimal(12,2) NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `gift` decimal(12,2) NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `qr_wallet` decimal(12,2) NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `state_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `district_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `bill_address` varchar(500) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `bill_landmark` varchar(500) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `id_card_url` longtext NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `kyc_status` varchar(20) NOT NULL DEFAULT 'none';
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `kyc_note` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `account_holder` varchar(150) NULL DEFAULT NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `welcome_1_wallet` decimal(12,2) NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `welcome_2_wallet` decimal(12,2) NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `welcome_3_wallet` decimal(12,2) NULL DEFAULT 0.00;
ALTER TABLE `variant_type_groups` ADD COLUMN IF NOT EXISTS `name` varchar(100) NOT NULL;
ALTER TABLE `variant_type_groups` ADD COLUMN IF NOT EXISTS `category_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `variant_type_groups` ADD COLUMN IF NOT EXISTS `fields` text NULL DEFAULT NULL;
ALTER TABLE `variant_type_groups` ADD COLUMN IF NOT EXISTS `status` enum('active','inactive') NOT NULL DEFAULT 'active';
ALTER TABLE `variant_type_groups` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `variant_type_groups` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `vendor_categories` ADD COLUMN IF NOT EXISTS `name` varchar(100) NOT NULL;
ALTER TABLE `vendor_categories` ADD COLUMN IF NOT EXISTS `image` longtext NULL DEFAULT NULL;
ALTER TABLE `vendor_categories` ADD COLUMN IF NOT EXISTS `status` enum('active','inactive') NOT NULL DEFAULT 'active';
ALTER TABLE `vendor_categories` ADD COLUMN IF NOT EXISTS `free_delivery_min` decimal(10,2) NULL DEFAULT 0.00;
ALTER TABLE `vendor_categories` ADD COLUMN IF NOT EXISTS `delivery_charge` decimal(10,2) NULL DEFAULT 0.00;
ALTER TABLE `vendor_categories` ADD COLUMN IF NOT EXISTS `gst_rate` decimal(5,2) NULL DEFAULT 0.00;
ALTER TABLE `vendor_categories` ADD COLUMN IF NOT EXISTS `display_order` int(10) unsigned NOT NULL DEFAULT 0;
ALTER TABLE `vendor_categories` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `vendor_categories` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `vendor_category_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `commission_pct` decimal(5,2) NULL DEFAULT 10.00;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `shop_name` varchar(150) NOT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `address` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `area` varchar(100) NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `state_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `district_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `taluk_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `pincode` varchar(10) NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `gst` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `image` longtext NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `banner_image` varchar(500) NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `trade_mark` varchar(500) NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `image_pending` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `image_status` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `image_reject_reason` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `vendor_profiles` ADD COLUMN IF NOT EXISTS `image_reviewed_by` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `vendor_templates` ADD COLUMN IF NOT EXISTS `name` varchar(150) NOT NULL;
ALTER TABLE `vendor_templates` ADD COLUMN IF NOT EXISTS `vendor_category_id` int(10) unsigned NULL DEFAULT NULL;
ALTER TABLE `vendor_templates` ADD COLUMN IF NOT EXISTS `commission_pct` decimal(5,2) NOT NULL DEFAULT 10.00;
ALTER TABLE `vendor_templates` ADD COLUMN IF NOT EXISTS `created_by` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `vendor_templates` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `vendor_templates` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;
ALTER TABLE `wallet_transactions` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `wallet_transactions` ADD COLUMN IF NOT EXISTS `peer_user_id` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `wallet_transactions` ADD COLUMN IF NOT EXISTS `amount` decimal(12,2) NOT NULL;
ALTER TABLE `wallet_transactions` ADD COLUMN IF NOT EXISTS `type` varchar(40) NOT NULL;
ALTER TABLE `wallet_transactions` ADD COLUMN IF NOT EXISTS `wallet` varchar(20) NULL DEFAULT NULL;
ALTER TABLE `wallet_transactions` ADD COLUMN IF NOT EXISTS `reference` varchar(80) NULL DEFAULT NULL;
ALTER TABLE `wallet_transactions` ADD COLUMN IF NOT EXISTS `notes` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `wallet_transactions` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `withdrawals` ADD COLUMN IF NOT EXISTS `user_id` bigint(20) unsigned NOT NULL;
ALTER TABLE `withdrawals` ADD COLUMN IF NOT EXISTS `amount` decimal(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `withdrawals` ADD COLUMN IF NOT EXISTS `method` varchar(20) NOT NULL;
ALTER TABLE `withdrawals` ADD COLUMN IF NOT EXISTS `details_json` text NULL DEFAULT NULL;
ALTER TABLE `withdrawals` ADD COLUMN IF NOT EXISTS `status` varchar(20) NOT NULL DEFAULT 'pending';
ALTER TABLE `withdrawals` ADD COLUMN IF NOT EXISTS `processed_by` bigint(20) unsigned NULL DEFAULT NULL;
ALTER TABLE `withdrawals` ADD COLUMN IF NOT EXISTS `notes` varchar(255) NULL DEFAULT NULL;
ALTER TABLE `withdrawals` ADD COLUMN IF NOT EXISTS `created_at` datetime NULL DEFAULT NULL;
ALTER TABLE `withdrawals` ADD COLUMN IF NOT EXISTS `updated_at` datetime NULL DEFAULT NULL;

-- Done.
