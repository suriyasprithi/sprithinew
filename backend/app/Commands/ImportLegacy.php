<?php

namespace App\Commands;

use CodeIgniter\CLI\BaseCommand;
use CodeIgniter\CLI\CLI;

/**
 * One-time importer for the legacy `u290807677_epey` MySQL dump.
 *
 *   php spark legacy:import path/to/u290807677_epey.sql
 *
 * Reads INSERT statements straight from the .sql file (no live connection to the
 * old DB) and maps every legacy row into the new schema. Old→new primary keys
 * are tracked in `legacy_id_map`, so foreign keys resolve and re-runs are
 * idempotent (already-mapped rows are skipped). The whole import runs inside a
 * single transaction and rolls back on any unexpected error.
 *
 * Design decisions (confirmed with the client):
 *  - Passwords copied verbatim into users.legacy_password (MD5); login upgrades
 *    them to bcrypt on first use.
 *  - Legacy `product` is a shared catalog assigned to vendors via
 *    `vendor_product`; since new products are single-vendor, each vendor_product
 *    row is cloned into its own product + variants.
 *  - Vendor geo is derived from the taluk-user who created the vendor
 *    (vendor.request_person_id).
 *  - Wallet balances are copied as-is; purchase/income/withdraw become
 *    historical wallet_transactions rows (no balance recomputation).
 */
class ImportLegacy extends BaseCommand
{
    protected $group       = 'Legacy';
    protected $name        = 'legacy:import';
    protected $description = 'Import the legacy u290807677_epey SQL dump into the new schema.';
    protected $usage       = 'legacy:import <path-to-sql>';
    protected $arguments   = ['file' => 'Path to the legacy .sql dump'];

    /** @var \CodeIgniter\Database\BaseConnection */
    private $db;
    private string $now;

    /** Parsed dump: [table => [assoc row, ...]] */
    private array $T = [];
    /** id map cache: idMap[oldTable][oldId] = newId */
    private array $idMap = [];
    /** counts[label] = ['imported'=>n,'skipped'=>n] */
    private array $counts = [];

    /** vendorCat[legacyVendorId] = new vendor_category_id */
    private array $vendorCat = [];
    /** staffGeo[legacyUserId] = ['state_id'=>,'district_id'=>,'taluk_id'=>] */
    private array $staffGeo = [];
    /** firstTaluk[legacyDistrictId] = new taluk_id (first one seen for that district) */
    private array $firstTaluk = [];
    /** variantClone[legacyVendorId][legacyVariantId] = new product_variants.id */
    private array $variantClone = [];
    /** variantProduct[newVariantId] = new products.id */
    private array $variantProduct = [];
    /** orderTotals[legacyOrderId] = float */
    private array $orderTotals = [];

    public function run(array $params)
    {
        $path = $params[0] ?? CLI::getSegment(2) ?? null;
        if (! $path) {
            CLI::error('Usage: php spark legacy:import <path-to-sql>');
            return;
        }
        if (! is_file($path)) {
            CLI::error("File not found: {$path}");
            return;
        }

        CLI::write("Reading {$path} ...", 'white');
        $sql       = file_get_contents($path);
        $this->T   = $this->parse($sql);
        $this->now = date('Y-m-d H:i:s');
        $this->db  = db_connect();

        $totalRows = array_sum(array_map('count', $this->T));
        CLI::write('Parsed ' . count($this->T) . " legacy tables, {$totalRows} rows.", 'white');

        // Preload existing id map for idempotency.
        foreach ($this->db->table('legacy_id_map')->get()->getResultArray() as $r) {
            $this->idMap[$r['old_table']][(string) $r['old_id']] = (int) $r['new_id'];
        }

        $this->db->transBegin();
        try {
            $this->importStates();
            $this->importDistricts();
            $this->importTaluks();
            $this->importStaff();        // legacy `user` (admin/state/district/taluk)
            $this->importDrivers();      // legacy `delivery_person`
            $this->importVendorCats();   // legacy `shop_category`
            $this->importVendors();      // legacy `vendor` -> users + vendor_profiles
            $this->importCustomers();    // legacy `customer`
            $this->fixReferrers();       // 2nd pass: customer.reffered_by
            $this->recoverStaffMobiles();// staff have serial codes in mobile_number; recover real phone from phonepe/gpay
            $this->importProductCats();  // legacy `category`
            $this->importProducts();     // legacy `product` + `vendor_product` (clone per vendor)
            $this->importCart();         // legacy `customer_cart`
            $this->importOrders();       // legacy `order`
            $this->importOrderItems();   // legacy `order_details`
            $this->importLedger();       // legacy `purchase` / `income` / `withdraw`
            $this->importTokenRequests();// legacy `token_request` / `vendor_request`
            $this->importDeliveryRates();// legacy `driver_km` / `driver_time`
            $this->importNotifications();// legacy `notification`
            $this->importTalukBanners(); // legacy `taluk_banner`
            $this->importBanners();      // legacy `banner` -> home_banners (lossy)
            $this->importSimple();       // lucky_draw, qr_request, subscription, support, otp, pincode, wishlist, review

            if ($this->db->transStatus() === false) {
                throw new \RuntimeException('Transaction flagged failed.');
            }
            $this->db->transCommit();
            CLI::write('Committed.', 'green');
        } catch (\Throwable $e) {
            $this->db->transRollback();
            CLI::error('Rolled back — ' . $e->getMessage());
            CLI::write($e->getFile() . ':' . $e->getLine(), 'red');
            return;
        }

        $this->report();
    }

    // ===================================================================
    // Geo
    // ===================================================================

    private function importStates(): void
    {
        foreach ($this->T['state'] ?? [] as $r) {
            if ($this->mapped('state', $r['id'])) { $this->tick('states', false); continue; }
            $id = $this->insert('states', [
                'name'       => $this->nz($r['name']) ?? 'State',
                'status'     => $this->act($r['status']),
                'created_at' => $this->now,
                'updated_at' => $this->now,
            ]);
            $this->record('state', $r['id'], 'states', $id);
            $this->tick('states', true);
        }
    }

    private function importDistricts(): void
    {
        foreach ($this->T['district'] ?? [] as $r) {
            if ($this->mapped('district', $r['id'])) { $this->tick('districts', false); continue; }
            $id = $this->insert('districts', [
                'name'       => $this->nz($r['name']) ?? 'District',
                'state_id'   => $this->map('state', $r['state_id']),
                'status'     => $this->act($r['status']),
                'created_at' => $this->now,
                'updated_at' => $this->now,
            ]);
            $this->record('district', $r['id'], 'districts', $id);
            $this->tick('districts', true);
        }
    }

    private function importTaluks(): void
    {
        foreach ($this->T['taluk'] ?? [] as $r) {
            if ($this->mapped('taluk', $r['id'])) {
                $this->tick('taluks', false);
                // still remember first taluk per district for delivery-rate fallback
                $newId = $this->map('taluk', $r['id']);
                $this->firstTaluk[(string) $r['district_id']] ??= $newId;
                continue;
            }
            $districtId = $this->map('district', $r['district_id']);
            if (! $districtId) { $this->tick('taluks', false); continue; } // district_id is NOT NULL
            $id = $this->insert('taluks', [
                'name'        => $this->nz($r['name']) ?? 'Taluk',
                'district_id' => $districtId,
                'status'      => $this->act($r['status']),
                'created_at'  => $this->now,
                'updated_at'  => $this->now,
            ]);
            $this->record('taluk', $r['id'], 'taluks', $id);
            $this->firstTaluk[(string) $r['district_id']] ??= $id;
            $this->tick('taluks', true);
        }
    }

    // ===================================================================
    // Users
    // ===================================================================

    private function importStaff(): void
    {
        $roles = [0 => 'admin', 1 => 'state', 2 => 'district', 3 => 'taluk'];
        foreach ($this->T['user'] ?? [] as $r) {
            $stateId = $this->map('state', $r['state_id']);
            $distId  = $this->map('district', $r['district_id']);
            $talukId = $this->map('taluk', $r['taluk_id']);
            // remember geo so vendors created by this staff can inherit it
            $this->staffGeo[(string) $r['id']] = ['state_id' => $stateId, 'district_id' => $distId, 'taluk_id' => $talukId];

            if ($this->mapped('user', $r['id'])) { $this->tick('users (staff)', false); continue; }
            $role = $roles[(int) $r['type']] ?? 'taluk';

            $newId = $this->insertUser([
                'name'          => $this->nz($r['name']) ?? 'Staff',
                'mobile_number' => $this->mobile($r['mobile_number']),
                'email'         => $this->nz($r['email']),
                'role'          => $role,
                'address_line'  => $this->nz($r['address']),
                'image'         => $this->nz($r['image']),
                'bank_name'     => $this->nz($r['bank_name']),
                'account_number'=> $this->nz($r['account_number']),
                'ifsc_code'     => $this->nz($r['ifsc_code']),
                'gpay'          => $this->nz($r['gpay']),
                'phonepe'       => $this->nz($r['phonepe']),
                'paytm'         => $this->nz($r['paytm']),
                'upi'           => $this->nz($r['upi']),
                'payment_link'  => $this->nz($r['payment_link']),
                'gift'          => $this->dec($r['gift']),
                'global_wallet' => $this->dec($r['global_wallet']),
                'monthly_wallet'=> $this->dec($r['monthly_wallet']),
                'lucky_wallet'  => $this->dec($r['lucky_wallet']),
                'wallet_balance'=> $this->dec($r['wallet']),
                'state_id'      => $stateId,
                'district_id'   => $distId,
                'taluk_id'      => $talukId,
                'status'        => $this->act($r['status']),
                'created_at'    => $this->dt($r['created_on']),
            ], $r['password']);
            if ($newId === null) { $this->tick('users (staff)', false); continue; }

            $this->record('user', $r['id'], 'users', $newId);
            $this->tick('users (staff)', true);

            // Back-fill the geo head pointer.
            if ($role === 'state' && $stateId)    { $this->db->table('states')->where('id', $stateId)->update(['user_id' => $newId]); }
            if ($role === 'district' && $distId)  { $this->db->table('districts')->where('id', $distId)->update(['user_id' => $newId]); }
            if ($role === 'taluk' && $talukId)    { $this->db->table('taluks')->where('id', $talukId)->update(['user_id' => $newId]); }
        }
    }

    private function importDrivers(): void
    {
        foreach ($this->T['delivery_person'] ?? [] as $r) {
            if ($this->mapped('delivery_person', $r['id'])) { $this->tick('users (driver)', false); continue; }
            $newId = $this->insertUser([
                'name'          => $this->nz($r['name']) ?? 'Driver',
                'mobile_number' => $this->mobile($r['mobile_number']),
                'email'         => $this->nz($r['email']),
                'role'          => 'driver',
                'address_line'  => $this->nz($r['address']),
                'image'         => $this->nz($r['profile']),
                'pincode'       => $this->nz($r['pincode']),
                'aadhar_image'  => $this->nz($r['aadhar_image']),
                'license_image' => $this->nz($r['license_image']),
                'rc_image'      => $this->nz($r['rc_image']),
                'state_id'      => $this->map('state', $r['state_id']),
                'district_id'   => $this->map('district', $r['district_id']),
                'status'        => $this->act($r['status']),
                'created_at'    => $this->dt($r['created_on']),
            ], $r['password']);
            if ($newId === null) { $this->tick('users (driver)', false); continue; }
            $this->record('delivery_person', $r['id'], 'users', $newId);
            $this->tick('users (driver)', true);
        }
    }

    private function importVendorCats(): void
    {
        foreach ($this->T['shop_category'] ?? [] as $r) {
            if ($this->mapped('shop_category', $r['id'])) { $this->tick('vendor_categories', false); continue; }
            $id = $this->insert('vendor_categories', [
                'name'       => $this->nz($r['category']) ?? 'Category',
                'image'      => $this->nz($r['image']),
                'status'     => $this->act($r['status']),
                'created_at' => $this->now,
                'updated_at' => $this->now,
            ]);
            $this->record('shop_category', $r['id'], 'vendor_categories', $id);
            $this->tick('vendor_categories', true);
        }
    }

    private function importVendors(): void
    {
        foreach ($this->T['vendor'] ?? [] as $r) {
            $venCat = $this->map('shop_category', $r['category_id']);
            $this->vendorCat[(string) $r['id']] = $venCat;
            $geo = $this->staffGeo[(string) $r['request_person_id']] ?? ['state_id' => null, 'district_id' => null, 'taluk_id' => null];

            if ($this->mapped('vendor', $r['id'])) { $this->tick('users (vendor)', false); continue; }

            $newId = $this->insertUser([
                'name'           => $this->nz($r['shop_name']) ?? 'Vendor',
                'mobile_number'  => $this->mobile($r['mobile_number']),
                'email'          => $this->nz($r['email']),
                'role'           => 'vendor',
                'address_line'   => $this->nz($r['address']),
                'image'          => $this->nz($r['image']),
                'bank_name'      => $this->nz($r['bank_name']),
                'account_number' => $this->nz($r['account_number']),
                'ifsc_code'      => $this->nz($r['ifsc_code']),
                'gpay'           => $this->nz($r['gpay']),
                'phonepe'        => $this->nz($r['phonepe']),
                'paytm'          => $this->nz($r['paytm']),
                'upi'            => $this->nz($r['upi']),
                'payment_link'   => $this->nz($r['payment_link']),
                'aadhar'         => $this->nz($r['aadhar']),
                'aadhar_image'   => $this->nz($r['aadhar_photo']),
                'pan'            => $this->nz($r['pan']),
                'pan_image'      => $this->nz($r['pan_photo']),
                'monthly_wallet' => $this->dec($r['monthly_wallet']),
                'wallet_balance' => $this->dec($r['wallet']),
                'qr_wallet'      => $this->dec($r['qr_wallet']),
                'pincode'        => $this->nz($r['pincode']),
                'state_id'       => $geo['state_id'],
                'district_id'    => $geo['district_id'],
                'taluk_id'       => $geo['taluk_id'],
                'status'         => $this->act($r['status']),
            ], $r['password']);
            if ($newId === null) { $this->tick('users (vendor)', false); continue; }

            $this->record('vendor', $r['id'], 'users', $newId);
            $this->tick('users (vendor)', true);

            $this->insert('vendor_profiles', [
                'user_id'            => $newId,
                'vendor_category_id' => $venCat,
                'commission_pct'     => $this->dec($r['commission']),
                'shop_name'          => $this->nz($r['shop_name']),
                'address'            => $this->nz($r['address']),
                'state_id'           => $geo['state_id'],
                'district_id'        => $geo['district_id'],
                'taluk_id'           => $geo['taluk_id'],
                'pincode'            => $this->nz($r['pincode']),
                'gst'                => $this->nz($r['gst']),
                'image'              => $this->nz($r['image']),
                'banner_image'       => $this->nz($r['banner_image']),
                'trade_mark'         => $this->nz($r['trade_mark']),
                'created_at'         => $this->now,
                'updated_at'         => $this->now,
            ]);
        }
    }

    private function importCustomers(): void
    {
        foreach ($this->T['customer'] ?? [] as $r) {
            if ($this->mapped('customer', $r['id'])) { $this->tick('users (customer)', false); continue; }
            $newId = $this->insertUser([
                'name'           => $this->nz($r['name']) ?? 'Customer',
                'mobile_number'  => $this->mobile($r['mobile_number']),
                'email'          => $this->nz($r['email']),
                'role'           => 'customer',
                'dob'            => $this->dt($r['dob']),
                'address_line'   => $this->nz($r['address']),
                'landmark'       => $this->nz($r['near_by']),
                'bill_address'   => $this->nz($r['bill_address']),
                'bill_landmark'  => $this->nz($r['bill_near_by']),
                'image'          => $this->nz($r['image']),
                'bank_name'      => $this->nz($r['bank_name']),
                'account_number' => $this->nz($r['account_number']),
                'ifsc_code'      => $this->nz($r['ifsc_code']),
                'gpay'           => $this->nz($r['gpay']),
                'phonepe'        => $this->nz($r['phonepe']),
                'paytm'          => $this->nz($r['paytm']),
                'upi'            => $this->nz($r['upi']),
                'payment_link'   => $this->nz($r['payment_link']),
                'aadhar'         => $this->nz($r['aadhar']),
                'aadhar_image'   => $this->nz($r['aadhar_photo']),
                'pan'            => $this->nz($r['pan']),
                'pan_image'      => $this->nz($r['pan_photo']),
                'bank_passbook'  => $this->nz($r['bank_passbook']),
                'global_wallet'  => $this->dec($r['global_wallet']),
                'level_wallet'   => $this->dec($r['level_wallet']),
                'level_1_wallet' => $this->dec($r['level_1']),
                'level_2_wallet' => $this->dec($r['level_2']),
                'level_3_wallet' => $this->dec($r['level_3']),
                'buyback_wallet' => $this->dec($r['buyback_wallet']),
                'monthly_wallet' => $this->dec($r['monthly_wallet']),
                'wallet_balance' => $this->dec($r['wallet']),
                'state_id'       => $this->map('state', $r['state_id']),
                'district_id'    => $this->map('district', $r['district_id']),
                'taluk_id'       => $this->map('taluk', $r['taluk']),
                'status'         => $this->act($r['status']),
                'created_at'     => $this->dt($r['created_on']),
            ], $r['password']);
            if ($newId === null) { $this->tick('users (customer)', false); continue; }
            $this->record('customer', $r['id'], 'users', $newId);
            $this->tick('users (customer)', true);
        }
    }

    private function fixReferrers(): void
    {
        foreach ($this->T['customer'] ?? [] as $r) {
            $ref = (int) ($r['reffered_by'] ?? 0);
            if ($ref <= 0) { continue; }
            $self = $this->map('customer', $r['id']);
            $by   = $this->map('customer', $ref);
            if ($self && $by) {
                $this->db->table('users')->where('id', $self)->update(['referrer_id' => $by]);
                $this->tick('referrer links', true);
            }
        }
    }

    /**
     * Legacy state/district/taluk staff stored a serial code (e.g. "01.0000000")
     * in mobile_number, not a phone; the real number — when present — sits in
     * phonepe/gpay. Recover it where it leaves (mobile_number, role) unique.
     * Staff whose number is shared (same operator runs two areas) keep their
     * code, since the unique key only allows one of them to take it.
     */
    private function recoverStaffMobiles(): void
    {
        $rows = $this->db->table('users')
            ->select('id, role, mobile_number, phonepe, gpay')
            ->whereIn('role', ['state', 'district', 'taluk'])
            ->get()->getResultArray();

        foreach ($rows as $u) {
            if ($this->isValidMobile($u['mobile_number'])) { continue; }
            $cand = $this->isValidMobile($u['phonepe']) ? $u['phonepe']
                : ($this->isValidMobile($u['gpay']) ? $u['gpay'] : null);
            if ($cand === null) { continue; }

            $taken = $this->db->table('users')
                ->where('mobile_number', $cand)
                ->where('role', $u['role'])
                ->where('id !=', $u['id'])
                ->countAllResults();
            if ($taken > 0) { $this->tick('staff mobile recovered', false); continue; }

            $this->db->table('users')->where('id', $u['id'])->update(['mobile_number' => $cand]);
            $this->tick('staff mobile recovered', true);
        }
    }

    private function isValidMobile(?string $v): bool
    {
        return $v !== null && preg_match('/^[6-9][0-9]{9}$/', $v) === 1;
    }

    // ===================================================================
    // Catalog
    // ===================================================================

    private function importProductCats(): void
    {
        // Legacy `category` (product categories) has no link to a vendor_category
        // and no token_cost — admin reconfigures later. Image column has no home.
        foreach ($this->T['category'] ?? [] as $r) {
            if ($this->mapped('category', $r['id'])) { $this->tick('categories', false); continue; }
            $id = $this->insert('categories', [
                'name'               => $this->nz($r['name']) ?? 'Category',
                'vendor_category_id' => null,
                'token_cost'         => 0,
                'status'             => $this->act($r['status']),
                'created_at'         => $this->now,
                'updated_at'         => $this->now,
            ]);
            $this->record('category', $r['id'], 'categories', $id);
            $this->tick('categories', true);
        }
    }

    private function importProducts(): void
    {
        $prodIx = $this->indexBy('product', 'id');
        $varIx  = $this->indexBy('product_variants', 'id');

        foreach ($this->T['vendor_product'] ?? [] as $vp) {
            if ($this->mapped('vendor_product', $vp['id'])) { $this->tick('products', false); continue; }
            $venNew = $this->map('vendor', $vp['vendor_id']);
            $prod   = $prodIx[(string) $vp['product']] ?? null;
            if (! $venNew || ! $prod) { $this->tick('products', false); continue; }

            $variantIds = preg_split('/[,\s]+/', (string) ($vp['product_variant'] ?? ''), -1, PREG_SPLIT_NO_EMPTY);
            $catNew = null;
            $price  = 0;
            if (! empty($variantIds) && isset($varIx[(string) $variantIds[0]])) {
                $fv     = $varIx[(string) $variantIds[0]];
                $catNew = $this->map('category', $fv['category_id']);
                $price  = $this->dec($fv['variant_ac_price']);
            }

            $newProductId = $this->insert('products', [
                'vendor_id'          => $venNew,
                'category_id'        => $catNew,
                'vendor_category_id' => $this->vendorCat[(string) $vp['vendor_id']] ?? null,
                'name'               => $this->nz($prod['name']) ?? 'Product',
                'image'              => $this->nz($prod['image']),
                'price'              => $price,
                'stock'              => 0,
                'has_variants'       => empty($variantIds) ? 0 : 1,
                'status'             => $this->act($prod['status']),
                'created_at'         => $this->dt($prod['created_on']) ?? $this->now,
                'updated_at'         => $this->now,
            ]);
            $this->record('vendor_product', $vp['id'], 'products', $newProductId);
            $this->tick('products', true);

            foreach ($variantIds as $vid) {
                $var = $varIx[(string) $vid] ?? null;
                if (! $var) { continue; }
                $options = json_encode(array_filter([
                    'measure'     => $this->nz($var['measure']),
                    'mrp'         => $this->nz($var['variant_mrp']),
                    'discount'    => $this->nz($var['variant_discount']),
                    'commission'  => $this->nz($var['variant_commission']),
                    'tags'        => $this->nz($var['variant_tags']),
                    'description' => $this->nz($var['variant_description']),
                ], static fn ($x) => $x !== null));

                $newVarId = $this->insert('product_variants', [
                    'product_id' => $newProductId,
                    'name'       => $this->nz($var['variant_name']) ?? 'Variant',
                    'sku'        => null,
                    'price'      => $this->dec($var['variant_ac_price']),
                    'stock'      => 0,
                    'image'      => $this->nz($var['variant_image']),
                    'options'    => $options,
                    'status'     => $this->act($var['status']),
                    'created_at' => $this->dt($var['created_on']) ?? $this->now,
                    'updated_at' => $this->now,
                ]);
                $this->variantClone[(string) $vp['vendor_id']][(string) $vid] = $newVarId;
                $this->variantProduct[$newVarId] = $newProductId;
                $this->record('pvar:' . $vp['vendor_id'], $vid, 'product_variants', $newVarId);
                $this->tick('product_variants', true);
            }
        }
    }

    private function importCart(): void
    {
        foreach ($this->T['customer_cart'] ?? [] as $r) {
            if ($this->mapped('customer_cart', $r['id'])) { $this->tick('cart_items', false); continue; }
            $userId = $this->map('customer', $r['cus_id']);
            $varId  = $this->variantClone[(string) $r['ven_id']][(string) $r['product_v_id']] ?? null;
            $prodId = $varId ? ($this->variantProduct[$varId] ?? null) : null;
            if (! $userId || ! $prodId) { $this->tick('cart_items', false); continue; }
            $id = $this->insert('cart_items', [
                'user_id'      => $userId,
                'product_id'   => $prodId,
                'variation_id' => $varId,
                'qty'          => max(1, (int) $this->dec($r['qty'])),
                'created_at'   => $this->dt($r['created_on']) ?? $this->now,
                'updated_at'   => $this->now,
            ]);
            $this->record('customer_cart', $r['id'], 'cart_items', $id);
            $this->tick('cart_items', true);
        }
    }

    // ===================================================================
    // Orders
    // ===================================================================

    private function importOrders(): void
    {
        // Precompute order totals from order_details (legacy order has no total).
        foreach ($this->T['order_details'] ?? [] as $od) {
            $line = $this->dec($od['variant_price']) * $this->dec($od['variant_qty']);
            $this->orderTotals[(string) $od['order_id']] = ($this->orderTotals[(string) $od['order_id']] ?? 0) + $line;
        }

        $statusMap = [0 => 'pending', 1 => 'assigned', 2 => 'picked', 3 => 'delivered'];
        foreach ($this->T['order'] ?? [] as $r) {
            if ($this->mapped('order', $r['id'])) { $this->tick('orders', false); continue; }
            $custId = $this->map('customer', $r['cus_id']);
            if (! $custId) { $this->tick('orders', false); continue; } // customer_id is NOT NULL

            $id = $this->insert('orders', [
                'customer_id'            => $custId,
                'vendor_id'              => $this->map('vendor', $r['ven_id']),
                'total'                  => $this->orderTotals[(string) $r['id']] ?? 0,
                'status'                 => $statusMap[(int) $r['order_status']] ?? 'pending',
                'notes'                  => $this->nz($r['order_description']),
                'order_number'           => $this->nz($r['order_id']),
                'delivery_address'       => $this->nz($r['address']),
                'bill_address'           => $this->nz($r['bill_address']),
                'delivery_landmark'      => $this->nz($r['near_by']),
                'bill_landmark'          => $this->nz($r['bill_near_by']),
                'payment_method'         => ((int) $r['payment_method'] === 1) ? 'cod' : 'online',
                'delivery_date'          => $this->nz($r['delivery_date']),
                'total_km'               => (int) $this->dec($r['total_km']),
                'delivery_minutes'       => $this->dec($r['delivery_time']),
                'driver_id'              => $this->map('delivery_person', $r['delivery_person']),
                'delivery_pincode'       => $this->nz($r['pincode']),
                'km_slab_id'             => $this->map('driver_km', $r['km_id']),
                'pay_to_vendor'          => (int) $this->dec($r['pay_to_vendor']) ? 1 : 0,
                'pay_to_admin'           => (int) $this->dec($r['pay_to_admin']) ? 1 : 0,
                'pay_to_delivery_person' => (int) $this->dec($r['pay_to_delivery_person']) ? 1 : 0,
                'delivery_person_amount' => $this->dec($r['delivery_person_amount']),
                'created_at'             => $this->dt($r['created_on']),
                'updated_at'             => $this->now,
            ]);
            $this->record('order', $r['id'], 'orders', $id);
            $this->tick('orders', true);
        }
    }

    private function importOrderItems(): void
    {
        $orderIx = $this->indexBy('order', 'id');
        foreach ($this->T['order_details'] ?? [] as $r) {
            if ($this->mapped('order_details', $r['id'])) { $this->tick('order_items', false); continue; }
            $orderNew = $this->map('order', $r['order_id']);
            $order    = $orderIx[(string) $r['order_id']] ?? null;
            if (! $orderNew || ! $order) { $this->tick('order_items', false); continue; }

            $varNew  = $this->variantClone[(string) $order['ven_id']][(string) $r['variant_id']] ?? null;
            $prodNew = $varNew ? ($this->variantProduct[$varNew] ?? null) : null;
            if (! $prodNew) { $this->tick('order_items', false); continue; } // product_id NOT NULL

            $qty   = max(1, (int) $this->dec($r['variant_qty']));
            $price = $this->dec($r['variant_price']);
            $id = $this->insert('order_items', [
                'order_id'          => $orderNew,
                'product_id'        => $prodNew,
                'variation_id'      => $varNew,
                'name'              => 'Item',
                'qty'               => $qty,
                'price'             => $price,
                'subtotal'          => $price * $qty,
                'commission_amount' => $this->dec($r['commission']),
            ]);
            $this->record('order_details', $r['id'], 'order_items', $id);
            $this->tick('order_items', true);
        }
    }

    // ===================================================================
    // Wallet ledger (historical only — balances already copied onto users)
    // ===================================================================

    private function importLedger(): void
    {
        foreach ($this->T['purchase'] ?? [] as $r) {
            if ($this->mapped('purchase', $r['id'])) { $this->tick('wallet_transactions', false); continue; }
            $user = $this->map('customer', $r['cus_id']) ?? $this->map('vendor', $r['ven_id']);
            if (! $user) { $this->tick('wallet_transactions', false); continue; }
            $id = $this->insert('wallet_transactions', [
                'user_id'      => $user,
                'peer_user_id' => $this->map('vendor', $r['ven_id']),
                'amount'       => $this->dec($r['amount']),
                'type'         => 'payment',
                'reference'    => $this->nz($r['purchase_id']),
                'notes'        => 'commission ' . $this->dec($r['commission']) . ' [legacy purchase]',
                'created_at'   => $this->dt($r['created_on']),
            ]);
            $this->record('purchase', $r['id'], 'wallet_transactions', $id);
            $this->tick('wallet_transactions', true);
        }

        foreach ($this->T['income'] ?? [] as $r) {
            if ($this->mapped('income', $r['id'])) { $this->tick('wallet_transactions', false); continue; }
            $user = $this->map('customer', $r['cus_id']);
            if (! $user) { $this->tick('wallet_transactions', false); continue; }
            $id = $this->insert('wallet_transactions', [
                'user_id'      => $user,
                'peer_user_id' => $this->map('vendor', $r['ven_id']),
                'amount'       => $this->dec($r['amount']),
                'type'         => 'commission',
                'reference'    => null,
                'notes'        => 'level ' . (int) $r['level'] . ' type ' . (int) $r['type'] . ' [legacy income]',
                'created_at'   => $this->dt($r['created_on']),
            ]);
            $this->record('income', $r['id'], 'wallet_transactions', $id);
            $this->tick('wallet_transactions', true);
        }

        foreach ($this->T['withdraw'] ?? [] as $r) {
            if ($this->mapped('withdraw', $r['id'])) { $this->tick('wallet_transactions', false); continue; }
            $user = $this->map('customer', $r['cus_id']) ?? $this->map('vendor', $r['ven_id']);
            if (! $user) { $this->tick('wallet_transactions', false); continue; }
            $id = $this->insert('wallet_transactions', [
                'user_id'      => $user,
                'peer_user_id' => null,
                'amount'       => $this->dec($r['amount']),
                'type'         => 'withdraw',
                'reference'    => $this->nz($r['transaction_id']),
                'notes'        => '[legacy withdraw]',
                'created_at'   => $this->dt($r['created_on']),
            ]);
            $this->record('withdraw', $r['id'], 'wallet_transactions', $id);
            $this->tick('wallet_transactions', true);
        }
    }

    private function importTokenRequests(): void
    {
        $st = [0 => 'pending', 1 => 'approved', 2 => 'rejected'];

        foreach ($this->T['token_request'] ?? [] as $r) {
            if ($this->mapped('token_request', $r['id'])) { $this->tick('token_requests', false); continue; }
            $req = $this->anyUser($r['user_id']);
            if (! $req) { $this->tick('token_requests', false); continue; }
            $id = $this->insert('token_requests', [
                'requester_id' => $req,
                'amount'       => $this->dec($r['profit']),
                'tokens'       => (int) $this->dec($r['request_token']),
                'status'       => $st[(int) $r['status']] ?? 'pending',
                'processed_by' => $this->anyUser($r['created_by']),
                'notes'        => trim($this->nz($r['payment_type']) . ' ' . $this->nz($r['image'])) ?: null,
                'created_at'   => $this->dt($r['created_on']),
                'updated_at'   => $this->now,
            ]);
            $this->record('token_request', $r['id'], 'token_requests', $id);
            $this->tick('token_requests', true);
        }

        foreach ($this->T['vendor_request'] ?? [] as $r) {
            if ($this->mapped('vendor_request', $r['id'])) { $this->tick('token_requests', false); continue; }
            $req = $this->map('vendor', $r['ven_id']);
            if (! $req) { $this->tick('token_requests', false); continue; }
            $id = $this->insert('token_requests', [
                'requester_id'   => $req,
                'target_user_id' => $this->talukHead($r['taluk_id']),
                'amount'         => $this->dec($r['profit']),
                'tokens'         => (int) $this->dec($r['request_token']),
                'status'         => $st[(int) $r['status']] ?? 'pending',
                'processed_by'   => $this->anyUser($r['created_by']),
                'notes'          => trim($this->nz($r['payment_type']) . ' ' . $this->nz($r['image'])) ?: null,
                'created_at'     => $this->dt($r['created_on']),
                'updated_at'     => $this->now,
            ]);
            $this->record('vendor_request', $r['id'], 'token_requests', $id);
            $this->tick('token_requests', true);
        }
    }

    private function importDeliveryRates(): void
    {
        foreach ($this->T['driver_km'] ?? [] as $r) {
            if ($this->mapped('driver_km', $r['id'])) { $this->tick('delivery_km_slabs', false); continue; }
            $taluk = $this->firstTaluk[(string) $this->legacyDistrictKey($r['district_id'])] ?? null;
            if (! $taluk) { $this->tick('delivery_km_slabs', false); continue; }
            $id = $this->insert('delivery_km_slabs', [
                'taluk_id'     => $taluk,
                'from_km'      => $this->dec($r['from']),
                'to_km'        => $this->dec($r['to']),
                'price_per_km' => $this->dec($r['price']),
                'created_at'   => $this->dt($r['created_on']) ?? $this->now,
                'updated_at'   => $this->now,
            ]);
            $this->record('driver_km', $r['id'], 'delivery_km_slabs', $id);
            $this->tick('delivery_km_slabs', true);
        }

        foreach ($this->T['driver_time'] ?? [] as $r) {
            if ($this->mapped('driver_time', $r['id'])) { $this->tick('delivery_time_rates', false); continue; }
            $taluk = $this->firstTaluk[(string) $this->legacyDistrictKey($r['district_id'])] ?? null;
            if (! $taluk) { $this->tick('delivery_time_rates', false); continue; }
            $id = $this->insert('delivery_time_rates', [
                'taluk_id'   => $taluk,
                'time_min'   => (int) $this->dec($r['from']),
                'price'      => $this->dec($r['price']),
                'created_at' => $this->dt($r['created_on']) ?? $this->now,
                'updated_at' => $this->now,
            ]);
            $this->record('driver_time', $r['id'], 'delivery_time_rates', $id);
            $this->tick('delivery_time_rates', true);
        }
    }

    private function importNotifications(): void
    {
        foreach ($this->T['notification'] ?? [] as $r) {
            if ($this->mapped('notification', $r['id'])) { $this->tick('notifications', false); continue; }
            $user = $this->map('customer', $r['cus_id'])
                ?? $this->map('vendor', $r['ven_id'])
                ?? $this->map('user', $r['user_id']);
            if (! $user) { $this->tick('notifications', false); continue; }
            $id = $this->insert('notifications', [
                'user_id'    => $user,
                'type'       => (string) (int) $r['type'],
                'title'      => 'Notification',
                'body'       => $this->nz($r['content']),
                'created_at' => $this->dt($r['created_on']),
            ]);
            $this->record('notification', $r['id'], 'notifications', $id);
            $this->tick('notifications', true);
        }
    }

    private function importTalukBanners(): void
    {
        foreach ($this->T['taluk_banner'] ?? [] as $r) {
            if ($this->mapped('taluk_banner', $r['id'])) { $this->tick('taluk_banners', false); continue; }
            $taluk = $this->map('taluk', $r['taluk_id']);
            if (! $taluk) { $this->tick('taluk_banners', false); continue; }
            $id = $this->insert('taluk_banners', [
                'taluk_id'   => $taluk,
                'banner_id'  => null,
                'text'       => $this->nz($r['text']),
                'image'      => $this->nz($r['image']),
                'link'       => $this->nz($r['link']),
                'status'     => (int) $r['status'] === 1 ? 1 : 0,
                'created_at' => $this->dt($r['created_on']),
            ]);
            $this->record('taluk_banner', $r['id'], 'taluk_banners', $id);
            $this->tick('taluk_banners', true);
        }
    }

    private function importBanners(): void
    {
        // Lossy: legacy flat banner -> structured hero-CMS row.
        foreach ($this->T['banner'] ?? [] as $r) {
            if ($this->mapped('banner', $r['id'])) { $this->tick('home_banners', false); continue; }
            $id = $this->insert('home_banners', [
                'slot'       => strtolower($this->nz($r['type']) ?? 'coupon'),
                'sort_order' => 0,
                'title'      => $this->nz($r['text']),
                'image_url'  => $this->nz($r['image']),
                'cta_href'   => $this->nz($r['link']),
                'status'     => (int) $r['status'] === 1 ? 'active' : 'inactive',
                'created_at' => $this->dt($r['created_on']) ?? $this->now,
                'updated_at' => $this->now,
            ]);
            $this->record('banner', $r['id'], 'home_banners', $id);
            $this->tick('home_banners', true);
        }
    }

    private function importSimple(): void
    {
        foreach ($this->T['lucky_draw'] ?? [] as $r) {
            if ($this->mapped('lucky_draw', $r['id'])) { $this->tick('lucky_draw_entries', false); continue; }
            $id = $this->insert('lucky_draw_entries', [
                'vendor_id'     => $this->map('vendor', $r['ven_id']),
                'taluk_id'      => $this->map('taluk', $r['taluk_id']),
                'set_number'    => (int) $this->dec($r['set']),
                'refer_code'    => $this->nz($r['refer']),
                'mobile_number' => $this->nz($r['mobile_number']),
                'status'        => (int) $r['status'] === 1 ? 1 : 0,
                'created_at'    => $this->dt($r['created_on']),
            ]);
            $this->record('lucky_draw', $r['id'], 'lucky_draw_entries', $id);
            $this->tick('lucky_draw_entries', true);
        }

        foreach ($this->T['qr_request'] ?? [] as $r) {
            if ($this->mapped('qr_request', $r['id'])) { $this->tick('qr_requests', false); continue; }
            $id = $this->insert('qr_requests', [
                'vendor_id'       => $this->map('vendor', $r['ven_id']),
                'customer_mobile' => $this->nz($r['mobile_number']),
                'amount'          => $this->dec($r['amount']),
                'status'          => (int) $this->dec($r['status']),
                'created_at'      => $this->dt($r['created_on']),
            ]);
            $this->record('qr_request', $r['id'], 'qr_requests', $id);
            $this->tick('qr_requests', true);
        }

        foreach ($this->T['subscription'] ?? [] as $r) {
            if ($this->mapped('subscription', $r['id'])) { $this->tick('email_subscriptions', false); continue; }
            $email = $this->nz($r['email']);
            if (! $email) { $this->tick('email_subscriptions', false); continue; }
            if ($this->db->table('email_subscriptions')->where('email', $email)->countAllResults() > 0) {
                $this->tick('email_subscriptions', false);
                continue;
            }
            $id = $this->insert('email_subscriptions', [
                'email'      => $email,
                'status'     => (int) $r['status'] === 1 ? 1 : 0,
                'created_at' => $this->dt($r['created_on']),
            ]);
            $this->record('subscription', $r['id'], 'email_subscriptions', $id);
            $this->tick('email_subscriptions', true);
        }

        foreach ($this->T['support'] ?? [] as $r) {
            if ($this->mapped('support', $r['id'])) { $this->tick('support_tickets', false); continue; }
            $user = $this->map('customer', $r['cus_id'])
                ?? $this->map('vendor', $r['ven_id'])
                ?? $this->map('user', $r['user_id']);
            $id = $this->insert('support_tickets', [
                'user_id'       => $user,
                'ticket_number' => $this->nz($r['support_id']),
                'type'          => (int) $this->dec($r['type']),
                'title'         => $this->nz($r['title']),
                'description'   => $this->nz($r['description']),
                'image'         => $this->nz($r['image']),
                'reply'         => $this->nz($r['reply']),
                'status'        => (int) $this->dec($r['status']),
                'created_at'    => $this->dt($r['created_on']),
            ]);
            $this->record('support', $r['id'], 'support_tickets', $id);
            $this->tick('support_tickets', true);
        }

        foreach ($this->T['otp'] ?? [] as $r) {
            if ($this->mapped('otp', $r['id'])) { $this->tick('otp_codes', false); continue; }
            $mobile = $this->nz($r['mobile_number']);
            if (! $mobile) { $this->tick('otp_codes', false); continue; }
            $user = $this->map('customer', $r['cus_id'])
                ?? $this->map('vendor', $r['ven_id'])
                ?? $this->map('user', $r['user_id']);
            $id = $this->insert('otp_codes', [
                'user_id'       => $user,
                'mobile_number' => $mobile,
                'otp'           => (string) $this->dec($r['otp']),
                'created_at'    => $this->now,
            ]);
            $this->record('otp', $r['id'], 'otp_codes', $id);
            $this->tick('otp_codes', true);
        }

        foreach ($this->T['pincode'] ?? [] as $r) {
            if ($this->mapped('pincode', $r['id'])) { $this->tick('pincodes', false); continue; }
            $code = $this->nz($r['code']);
            if (! $code) { $this->tick('pincodes', false); continue; }
            if ($this->db->table('pincodes')->where('code', $code)->countAllResults() > 0) {
                $this->tick('pincodes', false);
                continue;
            }
            $id = $this->insert('pincodes', [
                'code'       => $code,
                'created_at' => $this->dt($r['created_on']) ?? $this->now,
                'updated_at' => $this->now,
            ]);
            $this->record('pincode', $r['id'], 'pincodes', $id);
            $this->tick('pincodes', true);
        }

        foreach ($this->T['customer_wishlist'] ?? [] as $r) {
            if ($this->mapped('customer_wishlist', $r['id'])) { $this->tick('customer_wishlist', false); continue; }
            $varId  = $this->variantClone[(string) $r['ven_id']][(string) $r['product_v_id']] ?? null;
            $prodId = $varId ? ($this->variantProduct[$varId] ?? null) : null;
            $id = $this->insert('customer_wishlist', [
                'user_id'    => $this->map('customer', $r['cus_id']),
                'vendor_id'  => $this->map('vendor', $r['ven_id']),
                'product_id' => $prodId,
                'variant_id' => $varId,
                'status'     => (int) $r['status'] === 1 ? 1 : 0,
                'created_at' => $this->dt($r['created_on']),
            ]);
            $this->record('customer_wishlist', $r['id'], 'customer_wishlist', $id);
            $this->tick('customer_wishlist', true);
        }

        foreach ($this->T['customer_review'] ?? [] as $r) {
            if ($this->mapped('customer_review', $r['id'])) { $this->tick('product_reviews', false); continue; }
            $varId  = null;
            foreach ($this->variantClone as $byVendor) {
                if (isset($byVendor[(string) $r['product_v_id']])) { $varId = $byVendor[(string) $r['product_v_id']]; break; }
            }
            $prodId = $varId ? ($this->variantProduct[$varId] ?? null) : null;
            $id = $this->insert('product_reviews', [
                'user_id'    => $this->map('customer', $r['cus_id']),
                'product_id' => $prodId,
                'variant_id' => $varId,
                'rating'     => (int) $this->dec($r['star']),
                'review'     => $this->nz($r['review']),
                'image'      => $this->nz($r['image']),
                'status'     => (int) $r['status'] === 1 ? 1 : 0,
                'created_at' => $this->dt($r['created_on']),
            ]);
            $this->record('customer_review', $r['id'], 'product_reviews', $id);
            $this->tick('product_reviews', true);
        }
    }

    // ===================================================================
    // Helpers
    // ===================================================================

    /** Insert a users row; pre-checks the (mobile, role) unique key. Returns new id or null when skipped. */
    private function insertUser(array $data, $legacyPassword): ?int
    {
        $data['password_hash']   = '!';                       // unusable bcrypt placeholder
        $data['legacy_password'] = $this->nz($legacyPassword);
        $data['updated_at']      = $this->now;
        $data['created_at']      = $data['created_at'] ?? $this->now;

        $exists = $this->db->table('users')
            ->where('mobile_number', $data['mobile_number'])
            ->where('role', $data['role'])
            ->get()->getFirstRow('array');
        if ($exists) {
            // Map the duplicate onto the first occurrence so FKs still resolve.
            return (int) $exists['id'];
        }
        return $this->insert('users', $data);
    }

    private function insert(string $table, array $data): int
    {
        $ok = $this->db->table($table)->insert($data);
        if ($ok === false) {
            $err = $this->db->error();
            throw new \RuntimeException("INSERT {$table} failed [{$err['code']}] {$err['message']} | cols: " . implode(',', array_keys($data)));
        }
        return (int) $this->db->insertID();
    }

    private function record(string $oldT, $oldId, string $newT, int $newId): void
    {
        $this->idMap[$oldT][(string) $oldId] = $newId;
        $this->db->table('legacy_id_map')->insert([
            'old_table'  => $oldT,
            'old_id'     => (int) $oldId,
            'new_table'  => $newT,
            'new_id'     => $newId,
            'created_at' => $this->now,
        ]);
    }

    private function map(string $oldT, $oldId): ?int
    {
        if ($oldId === null || (int) $oldId === 0) { return null; }
        return $this->idMap[$oldT][(string) $oldId] ?? null;
    }

    private function mapped(string $oldT, $oldId): bool
    {
        return isset($this->idMap[$oldT][(string) $oldId]);
    }

    /** Resolve an ambiguous legacy user id that may be a staff/vendor/customer. */
    private function anyUser($oldId): ?int
    {
        return $this->map('user', $oldId) ?? $this->map('vendor', $oldId) ?? $this->map('customer', $oldId);
    }

    /** New user id of the head of a legacy taluk. */
    private function talukHead($legacyTalukId): ?int
    {
        $taluk = $this->map('taluk', $legacyTalukId);
        if (! $taluk) { return null; }
        $row = $this->db->table('taluks')->select('user_id')->where('id', $taluk)->get()->getFirstRow('array');
        return $row && $row['user_id'] ? (int) $row['user_id'] : null;
    }

    private function legacyDistrictKey($districtId): string
    {
        return (string) $districtId;
    }

    private function indexBy(string $table, string $key): array
    {
        $out = [];
        foreach ($this->T[$table] ?? [] as $r) {
            $out[(string) $r[$key]] = $r;
        }
        return $out;
    }

    private function tick(string $label, bool $imported): void
    {
        $this->counts[$label] ??= ['imported' => 0, 'skipped' => 0];
        $this->counts[$label][$imported ? 'imported' : 'skipped']++;
    }

    private function report(): void
    {
        CLI::write('');
        CLI::write('Import summary', 'yellow');
        ksort($this->counts);
        foreach ($this->counts as $label => $c) {
            CLI::write(sprintf('  %-22s %5d imported, %5d skipped', $label, $c['imported'], $c['skipped']));
        }
    }

    // --- value normalisers ---------------------------------------------

    /** Trimmed string, or null when empty/null. */
    private function nz($v): ?string
    {
        if ($v === null) { return null; }
        $v = trim((string) $v);
        return $v === '' ? null : $v;
    }

    /** Numeric value as float (0 when empty/null). */
    private function dec($v): float
    {
        if ($v === null || $v === '') { return 0.0; }
        return (float) $v;
    }

    /** Legacy status int -> ENUM('active','inactive'). */
    private function act($v): string
    {
        return (int) $v === 1 ? 'active' : 'inactive';
    }

    /** Datetime passthrough; null for empty / zero dates. */
    private function dt($v): ?string
    {
        if ($v === null) { return null; }
        $v = trim((string) $v);
        if ($v === '' || str_starts_with($v, '0000-00-00')) { return null; }
        return $v;
    }

    /** Clamp a legacy mobile to the 15-char column. */
    private function mobile($v): string
    {
        return substr(trim((string) ($v ?? '')), 0, 15);
    }

    // --- SQL dump parser -----------------------------------------------

    /** Parse all INSERT statements into [table => [assoc row, ...]]. */
    private function parse(string $sql): array
    {
        $tables = [];
        $len    = strlen($sql);
        $offset = 0;
        while (preg_match('/INSERT\s+INTO\s+`([A-Za-z0-9_]+)`\s*\(([^)]*)\)\s*VALUES/i', $sql, $m, PREG_OFFSET_CAPTURE, $offset)) {
            $table = $m[1][0];
            $cols  = array_map(static fn ($c) => trim(trim($c), " `"), explode(',', $m[2][0]));
            $i     = $m[0][1] + strlen($m[0][0]);
            $tables[$table] ??= [];

            while ($i < $len) {
                while ($i < $len && (ctype_space($sql[$i]) || $sql[$i] === ',')) { $i++; }
                if ($i >= $len || $sql[$i] === ';') { if ($i < $len) { $i++; } break; }
                if ($sql[$i] !== '(') { break; }
                $vals = $this->parseTuple($sql, $i);
                $row  = [];
                foreach ($cols as $k => $cn) { $row[$cn] = $vals[$k] ?? null; }
                $tables[$table][] = $row;
            }
            $offset = $i;
        }
        return $tables;
    }

    /** Parse one `( ... )` tuple starting at $i (which must point at '('). Advances $i past ')'. */
    private function parseTuple(string $s, int &$i): array
    {
        $i++; // skip '('
        $len  = strlen($s);
        $vals = [];
        while ($i < $len) {
            while ($i < $len && ctype_space($s[$i])) { $i++; }
            if ($i >= $len) { break; }

            if ($s[$i] === "'") {
                $i++;
                $buf = '';
                while ($i < $len) {
                    $c = $s[$i];
                    if ($c === '\\') { $buf .= $this->unescape($s[$i + 1] ?? ''); $i += 2; continue; }
                    if ($c === "'") {
                        if (($s[$i + 1] ?? '') === "'") { $buf .= "'"; $i += 2; continue; }
                        $i++; break;
                    }
                    $buf .= $c; $i++;
                }
                $vals[] = $buf;
            } else {
                $buf = '';
                while ($i < $len && $s[$i] !== ',' && $s[$i] !== ')') { $buf .= $s[$i]; $i++; }
                $buf    = trim($buf);
                $vals[] = (strtoupper($buf) === 'NULL' || $buf === '') ? null : $buf;
            }

            while ($i < $len && ctype_space($s[$i])) { $i++; }
            if ($i < $len && $s[$i] === ',') { $i++; continue; }
            if ($i < $len && $s[$i] === ')') { $i++; break; }
        }
        return $vals;
    }

    private function unescape(string $c): string
    {
        return match ($c) {
            'n'     => "\n",
            'r'     => "\r",
            't'     => "\t",
            '0'     => "\0",
            'Z'     => chr(26),
            '\\'    => '\\',
            "'"     => "'",
            '"'     => '"',
            default => $c,
        };
    }
}
