-- ============================================================================
-- SPRITHI prod (u290807677_sprithi_new) — Product Import feature
-- MariaDB 11.x supports ADD/DROP ... IF [NOT] EXISTS. Safe to re-run (idempotent).
-- Apply via phpMyAdmin → SQL tab. This is everything the catalog import needs.
-- ============================================================================

-- 1) Base product columns the import relies on. mrp/code/barcode + the
--    variant / vendor-category columns that persistProduct() always writes
--    (added by later migrations, so a drifted prod may be missing them).
ALTER TABLE `products`
  ADD COLUMN IF NOT EXISTS `vendor_category_id` INT UNSIGNED  NULL,
  ADD COLUMN IF NOT EXISTS `variant_types`      TEXT          NULL,
  ADD COLUMN IF NOT EXISTS `variant_images`     LONGTEXT      NULL,
  ADD COLUMN IF NOT EXISTS `mrp`                DECIMAL(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `code`               VARCHAR(50)   NULL,
  ADD COLUMN IF NOT EXISTS `barcode`            VARCHAR(50)   NULL;

-- 2) Material Master accounting columns (stored, never shown to customers)
ALTER TABLE `products`
  ADD COLUMN IF NOT EXISTS `cost_price`               DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `profit_percent`           DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `profit`                   DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `basic_price`              DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `discount_percent`         DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `discount`                 DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `wholesale_profit_percent` DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `wholesale_profit`         DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `wholesale_price`          DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `incentive`                DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `incentive_percent`        DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `cashback`                 DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `cashback_percent`         DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `net_profit`               DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `tax_amount`               DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `wholesales_2`             DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `gst`                      DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `gst_value`                DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `supplier_price`           DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `agent_commission_perc`    DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `agent_commission`         DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `cess`                     DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `cess_rate`                DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `covid`                    DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `covid_percent`            DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `cost_price_exceed`        DECIMAL(18,2) NULL,
  ADD COLUMN IF NOT EXISTS `manual_rate`              VARCHAR(10)  NULL,
  ADD COLUMN IF NOT EXISTS `tax_type`                 VARCHAR(50)  NULL,
  ADD COLUMN IF NOT EXISTS `agent`                    VARCHAR(100) NULL,
  ADD COLUMN IF NOT EXISTS `csquare`                  VARCHAR(50)  NULL,
  ADD COLUMN IF NOT EXISTS `multi_pricing`            VARCHAR(50)  NULL,
  ADD COLUMN IF NOT EXISTS `created_date`             DATETIME     NULL,
  ADD COLUMN IF NOT EXISTS `modified_date`            DATETIME     NULL;

-- 3) Comprehensive catalog columns (this feature)
ALTER TABLE `products`
  ADD COLUMN IF NOT EXISTS `tax_percentage`    DECIMAL(8,2)  NULL,
  ADD COLUMN IF NOT EXISTS `discount_value`    DECIMAL(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `discount_amount`   DECIMAL(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `weight`            DECIMAL(12,3) NULL,
  ADD COLUMN IF NOT EXISTS `length`            DECIMAL(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `width`             DECIMAL(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `height`            DECIMAL(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `delivery_charge`   DECIMAL(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `min_stock_alert`   INT           NULL,
  ADD COLUMN IF NOT EXISTS `max_order_qty`     INT           NULL,
  ADD COLUMN IF NOT EXISTS `return_days`       INT           NULL,
  ADD COLUMN IF NOT EXISTS `warranty_days`     INT           NULL,
  ADD COLUMN IF NOT EXISTS `brand`             VARCHAR(120)  NULL,
  ADD COLUMN IF NOT EXISTS `hsn_code`          VARCHAR(20)   NULL,
  ADD COLUMN IF NOT EXISTS `discount_type`     VARCHAR(20)   NULL,
  ADD COLUMN IF NOT EXISTS `unit`              VARCHAR(20)   NULL,
  ADD COLUMN IF NOT EXISTS `short_description` VARCHAR(300)  NULL,
  ADD COLUMN IF NOT EXISTS `tags`              VARCHAR(500)  NULL,
  ADD COLUMN IF NOT EXISTS `gallery_images`    TEXT          NULL,
  ADD COLUMN IF NOT EXISTS `featured`          TINYINT(1)    NULL DEFAULT 0;

-- 4) Categories: self-referential parent for sub-categories,
--    and relax the global UNIQUE(name) to a plain index.
ALTER TABLE `categories`
  ADD COLUMN IF NOT EXISTS `parent_id` INT UNSIGNED NULL AFTER `name`;

ALTER TABLE `categories` DROP INDEX IF EXISTS `name`;
ALTER TABLE `categories` ADD INDEX IF NOT EXISTS `idx_categories_name`   (`name`);
ALTER TABLE `categories` ADD INDEX IF NOT EXISTS `idx_categories_parent` (`parent_id`);

-- 5) Per-variant catalog fields (universal variant importer).
ALTER TABLE `product_variants`
  ADD COLUMN IF NOT EXISTS `mrp`     DECIMAL(12,2) NULL,
  ADD COLUMN IF NOT EXISTS `barcode` VARCHAR(64)   NULL,
  ADD COLUMN IF NOT EXISTS `weight`  DECIMAL(12,3) NULL;
