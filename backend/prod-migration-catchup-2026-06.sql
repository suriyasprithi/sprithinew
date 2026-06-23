-- ============================================================================
-- PRODUCTION schema catch-up for the 2026-06-19 → 2026-06-22 migration batch.
-- Target DB: u290807677_sprithi_new (app.sprithi.com).
--
-- WHY: production code references columns/tables added by recent migrations that
-- the prod DB is missing (migration-table drift → `php spark migrate` unreliable).
-- The missing columns throw "Unknown column" → HTTP 500 on Orders / Customer-
-- purchase / order writes (and related flows).
--
-- SAFE / IDEMPOTENT: every statement uses IF NOT EXISTS, so running it again — or
-- on a DB that already has some of these — is a harmless no-op. MariaDB 10.0.2+.
-- Run via phpMyAdmin (Import or SQL tab) against the production database.
-- Take a DB backup first.
-- ============================================================================

-- orders: recent columns -----------------------------------------------------
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `qr_transferred_at`         DATETIME NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `commission_distributed_at` DATETIME NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `prescription_path`         VARCHAR(255) NULL;
ALTER TABLE `orders` ADD COLUMN IF NOT EXISTS `sale_mode`                 VARCHAR(20) NULL;

-- users: welcome (signup-bonus) wallets --------------------------------------
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `welcome_1_wallet` DECIMAL(12,2) NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `welcome_2_wallet` DECIMAL(12,2) NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `welcome_3_wallet` DECIMAL(12,2) NULL DEFAULT 0.00;

-- users: driver fields (fixes "New driver" 500 if these are missing) ----------
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `vehicle_number` VARCHAR(20) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `license_number` VARCHAR(50) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `monthly_salary` DECIMAL(12,2) NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `km_rate`        DECIMAL(8,2)  NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `hour_rate`      DECIMAL(8,2)  NOT NULL DEFAULT 0.00;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `shift`          VARCHAR(50) NULL;
ALTER TABLE `users` ADD COLUMN IF NOT EXISTS `id_card_url`    LONGTEXT NULL;

-- vendor_categories: delivery + GST ------------------------------------------
ALTER TABLE `vendor_categories` ADD COLUMN IF NOT EXISTS `free_delivery_min` DECIMAL(10,2) NULL DEFAULT 0.00;
ALTER TABLE `vendor_categories` ADD COLUMN IF NOT EXISTS `delivery_charge`   DECIMAL(10,2) NULL DEFAULT 0.00;
ALTER TABLE `vendor_categories` ADD COLUMN IF NOT EXISTS `gst_rate`          DECIMAL(5,2)  NULL DEFAULT 0.00;

-- categories: tree -----------------------------------------------------------
ALTER TABLE `categories` ADD COLUMN IF NOT EXISTS `parent_id` INT UNSIGNED NULL;

-- products + variants: catalog fields ----------------------------------------
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `gallery_images` TEXT NULL;
ALTER TABLE `products` ADD COLUMN IF NOT EXISTS `featured`       TINYINT(1) NULL DEFAULT 0;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `mrp`     DECIMAL(12,2) NULL;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `barcode` VARCHAR(64) NULL;
ALTER TABLE `product_variants` ADD COLUMN IF NOT EXISTS `weight`  DECIMAL(12,3) NULL;

-- buyback cycle tracking -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `buyback_cycles` (
  `id`           BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`      BIGINT(20) UNSIGNED NOT NULL,
  `next_slot`    TINYINT(3) UNSIGNED NOT NULL DEFAULT 1,
  `status`       VARCHAR(20) NOT NULL DEFAULT 'open',
  `opened_at`    DATETIME DEFAULT NULL,
  `completed_at` DATETIME DEFAULT NULL,
  `created_at`   DATETIME DEFAULT NULL,
  `updated_at`   DATETIME DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `status_opened_at` (`status`,`opened_at`),
  KEY `user_id_status` (`user_id`,`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE `purchase_commissions` ADD COLUMN IF NOT EXISTS `buyback_cycle_id` BIGINT(20) UNSIGNED NULL;

-- level unlock thresholds (welcome-wallet gating) ----------------------------
UPDATE `system_settings` SET `value`='1000000'
  WHERE `setting_key`='level.unlock_threshold_3' AND `value`='100000';
INSERT INTO `system_settings` (`setting_key`,`value`)
  SELECT 'level.unlock_threshold_1','100' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM `system_settings` WHERE `setting_key`='level.unlock_threshold_1');
INSERT INTO `system_settings` (`setting_key`,`value`)
  SELECT 'level.unlock_threshold_2','10000' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM `system_settings` WHERE `setting_key`='level.unlock_threshold_2');
INSERT INTO `system_settings` (`setting_key`,`value`)
  SELECT 'level.unlock_threshold_3','1000000' FROM DUAL
  WHERE NOT EXISTS (SELECT 1 FROM `system_settings` WHERE `setting_key`='level.unlock_threshold_3');
